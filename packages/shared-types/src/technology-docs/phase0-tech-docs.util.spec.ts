import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPhase0TechDocsQueryText,
  extractExplicitContext7Query,
  isExplicitContext7ChatRequest,
  resolveTechDocCandidatesFromText,
  shouldAutoFetchPhase0TechDocs,
} from "./phase0-tech-docs.util.js";

describe("phase0-tech-docs.util", () => {
  it("shouldAutoFetchPhase0TechDocs detecta PAT y OAuth", () => {
    assert.equal(
      shouldAutoFetchPhase0TechDocs("¿Cuál debe ser el formato de los tokens API/PAT para usuarios?"),
      true,
    );
    assert.equal(shouldAutoFetchPhase0TechDocs("Flujo OAuth 2.0 con refresh token"), true);
    assert.equal(shouldAutoFetchPhase0TechDocs("Lista de funcionalidades del MVP"), false);
  });

  it("isExplicitContext7ChatRequest detecta pedido explícito", () => {
    assert.equal(
      isExplicitContext7ChatRequest("Según Context7, ¿cómo recomienda GitHub el formato de PAT?"),
      true,
    );
    assert.equal(isExplicitContext7ChatRequest("Consulta context7 sobre JWT claims"), true);
    assert.equal(isExplicitContext7ChatRequest("¿Formato del webhook?"), false);
  });

  it("extractExplicitContext7Query limpia el prefijo meta", () => {
    assert.equal(
      extractExplicitContext7Query("Según Context7, ¿cómo recomienda GitHub el formato de PAT?"),
      "¿cómo recomienda GitHub el formato de PAT?",
    );
  });

  it("resolveTechDocCandidatesFromText incluye GitHub para PAT", () => {
    const candidates = resolveTechDocCandidatesFromText(
      "Formato de PAT para integración con GitHub API",
      3,
    );
    assert.ok(candidates.some((c) => c.libraryName.includes("github")));
  });

  it("buildPhase0TechDocsQueryText concatena pregunta y respuesta", () => {
    const q = buildPhase0TechDocsQueryText({
      question: "¿Formato PAT?",
      answer: "Usamos GitHub para CI",
    });
    assert.match(q, /Formato PAT/);
    assert.match(q, /GitHub/);
  });
});
