import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { IntentClassifierService } from "./intent-classifier.service.js";
import { IntentRouterService } from "./intent-router.service.js";
import type { AiService } from "./ai.service.js";
import { summarizeMessageForIntentClassification } from "./intent-router.util.js";

describe("summarizeMessageForIntentClassification", () => {
  it("conserva la instrucción del usuario y omite la spec embebida", () => {
    const spec =
      "# Especificación del Portal\n\n## 1. Visión\n\n".repeat(80) +
      "POST /licenses/validate\n";
    const message =
      "lo ideal es que nuestro portal cumpla con estas especificaciones\n\n" + spec;
    const summary = summarizeMessageForIntentClassification(message, 2000);
    assert.match(summary, /lo ideal es que/i);
    assert.match(summary, /omitido para clasificación/i);
    assert.doesNotMatch(summary, /POST \/licenses\/validate/);
  });
});

describe("IntentRouterService", () => {
  let llmCalls = 0;
  let llmResponse = JSON.stringify({
    action: "edit_document",
    confidence: 0.91,
    reasoning: "Pide integrar spec en el documento",
  });
  const prevEnv = process.env.INTENT_ROUTER_LLM;

  beforeEach(() => {
    llmCalls = 0;
    process.env.INTENT_ROUTER_LLM = "1";
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.INTENT_ROUTER_LLM;
    else process.env.INTENT_ROUTER_LLM = prevEnv;
  });

  function buildRouter() {
    const classifier = new IntentClassifierService();
    const ai = {
      generateResponse: async () => {
        llmCalls += 1;
        return llmResponse;
      },
    } as unknown as AiService;
    return new IntentRouterService(classifier, ai);
  }

  it("usa heurística alta confianza para spec pegada (sin LLM)", async () => {
    const router = buildRouter();
    const spec =
      "# Especificación del Portal de Licencias\n\n---\n\n## 1. Visión General\n\n".repeat(12) +
      "POST /licenses/validate\n";
    const message =
      "lo ideal es que nuestro portal, en licenciamiento, pudiera complir con estas especificaciones\n\n" +
      spec;

    const route = await router.route(message, { activeTab: "benchmark", hasDocumentContent: true });
    assert.equal(route.action, "edit_document");
    assert.equal(route.source, "heuristic");
    assert.equal(llmCalls, 0);
  });

  it("usa heurística para pregunta exploratoria (sin LLM)", async () => {
    const router = buildRouter();
    const message = "¿Qué tal si usamos Redis para cache? ¿Cómo sería la arquitectura?";
    const route = await router.route(message, { activeTab: "mdd", hasDocumentContent: true });
    assert.equal(route.action, "chat_only");
    assert.equal(route.source, "heuristic");
    assert.equal(llmCalls, 0);
  });

  it("consulta LLM en mensaje ambiguo con señales débiles de edición", async () => {
    const router = buildRouter();
    const message =
      "Estuve revisando licenses.theforge.dev y tal vez el documento debería alinear endpoints y tiers con eso, " +
      "aunque no estoy seguro del alcance exacto.";
    const route = await router.route(message, { activeTab: "benchmark", hasDocumentContent: true });
    assert.equal(route.action, "edit_document");
    assert.equal(route.source, "llm");
    assert.equal(llmCalls, 1);
  });

  it("respeta INTENT_ROUTER_LLM=0", async () => {
    process.env.INTENT_ROUTER_LLM = "0";
    llmResponse = JSON.stringify({
      action: "edit_document",
      confidence: 0.99,
      reasoning: "no debería usarse",
    });
    const router = buildRouter();
    const message =
      "Estuve revisando el portal de licencias y tal vez el documento debería alinear endpoints.";
    const route = await router.route(message, { activeTab: "benchmark", hasDocumentContent: true });
    assert.equal(route.source, "heuristic");
    assert.equal(llmCalls, 0);
  });

  it("cachea el resultado por mensaje+tab", async () => {
    const router = buildRouter();
    const message =
      "Estuve revisando el portal de licencias y tal vez el documento debería alinear endpoints.";
    await router.route(message, { activeTab: "benchmark", hasDocumentContent: true });
    await router.route(message, { activeTab: "benchmark", hasDocumentContent: true });
    assert.equal(llmCalls, 1);
  });
});
