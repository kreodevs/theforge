/**
 * Contract tests — `SessionsService.chat` por tab y delimitadores (Fase 0).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runWithRequestUserAsync } from "../../common/request-user.store.js";
import { SessionsService } from "./sessions.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";
import type { AiService } from "../ai/ai.service.js";
import type { PreferencesService } from "../ai/preferences.service.js";
import { ChatResponseParserService } from "./chat-response-parser.service.js";
import type { IntentRouterService } from "../ai/intent-router.service.js";
import type { IntentRouteResult } from "../ai/intent-route.types.js";
import type { DocumentSnapshotService } from "../document-snapshot/document-snapshot.service.js";
import type { ChatMessage } from "@theforge/shared-types";

const USER_ID = "user-contract-test";
const SESSION_ID = "sess-chat-contract";
const PROJECT_ID = "proj-chat-contract";

function docWithFin(tag: string, body: string, chat = "Listo."): string {
  return `${body}\n\n---FIN_${tag}---\n\n${chat}`;
}

/** MDD mínimo con §1–§7 para que el merge no rechace el documento en contrato. */
function minimalMddSevenSections(): string {
  return [
    "# Master Design Document",
    "",
    "## 1. Contexto",
    "",
    "Producto de prueba con contenido suficiente para validación estructural del contrato de chat.",
    "",
    "## 2. Arquitectura y Stack",
    "",
    "NestJS y PostgreSQL en contenedor único.",
    "",
    "## 3. Modelo de Datos",
    "",
    "Entidad User con email único.",
    "",
    "## 4. Contratos de API",
    "",
    "GET /health — liveness.",
    "",
    "## 5. Lógica y Edge Cases",
    "",
    "Validación de entrada en DTOs.",
    "",
    "## 6. Seguridad",
    "",
    "JWT RS256 y Argon2id.",
    "",
    "## 7. Infraestructura",
    "",
    "Docker Compose con Postgres.",
  ].join("\n");
}

function buildSessionsService(
  llmByTab: Record<string, string>,
  intent: IntentRouteResult = {
    intent: "direct_edit",
    action: "edit_document",
    confidence: 1,
    source: "heuristic",
  },
) {
  const sessionRow = {
    id: SESSION_ID,
    projectId: PROJECT_ID,
    userId: USER_ID,
    chatLog: [] as ChatMessage[],
    contextStep: "CONTEXT",
  };

  const prisma = {
    session: {
      findFirst: async () => ({ ...sessionRow, chatLog: [...sessionRow.chatLog] }),
      update: async ({ data }: { data: { chatLog?: object } }) => {
        if (data.chatLog) sessionRow.chatLog = data.chatLog as ChatMessage[];
        return { ...sessionRow, chatLog: [...sessionRow.chatLog] };
      },
    },
    project: {
      findFirst: async () => ({
        id: PROJECT_ID,
        userId: USER_ID,
        visibility: "PRIVATE",
      }),
    },
  } as unknown as PrismaService;

  const ai = {
    generateResponse: async (_prompt: string, _history: unknown[], options?: { activeTab?: string }) => {
      const tab = options?.activeTab ?? "mdd";
      const body = llmByTab[tab];
      if (!body) throw new Error(`No mock LLM for tab ${tab}`);
      return body;
    },
  } as unknown as AiService;

  const preferences = {
    getPreferencesForContext: async () => "",
  } as unknown as PreferencesService;

  const parser = new ChatResponseParserService();

  const intentRouter = {
    route: async () => intent,
  } as unknown as IntentRouterService;

  const documentSnapshot = {
    snapshotBeforeOverwrite: async () => undefined,
  } as unknown as DocumentSnapshotService;

  return new SessionsService(prisma, ai, preferences, parser, intentRouter, documentSnapshot);
}

const CHAT_RESPONSE_KEYS = [
  "session",
  "documentHadDelimiter",
  "documentPersisted",
  "mddContent",
  "dbgaContent",
  "specContent",
  "documentAst",
  "documentVersion",
] as const;

describe("SessionsService.chat contract (Fase 0)", () => {
  it("tab mdd: parsea ---FIN_MDD--- y expone mddContent", async () => {
    const mddBody = minimalMddSevenSections();
    const llm = docWithFin("MDD", mddBody);
    const service = buildSessionsService({ mdd: llm });

    const result = await runWithRequestUserAsync(USER_ID, () =>
      service.chat(SESSION_ID, "Actualiza el MDD", {
        activeTab: "mdd",
        currentMddContent: "",
      }),
    );

    assert.ok(result.session);
    assert.equal(result.documentHadDelimiter, true);
    assert.ok(result.mddContent?.includes("## 1. Contexto"));
    assert.ok(result.mddContent?.includes("## 7. Infraestructura"));
    for (const key of CHAT_RESPONSE_KEYS) {
      assert.ok(key in result, `missing contract key: ${key}`);
    }
  });

  it("tab benchmark: parsea ---FIN_DBGA--- y expone dbgaContent", async () => {
    const dbgaBody = [
      "# Domain Benchmark & Gap Analysis",
      "",
      "## Referencia de Industria",
      "",
      "Contenido de benchmark para contrato con delimitador DBGA y suficiente extensión.",
      "",
      "## Análisis de brechas",
      "",
      "Detalle de gaps identificados para el producto objetivo.",
    ].join("\n");
    const llm = docWithFin("DBGA", dbgaBody);
    const service = buildSessionsService(
      { benchmark: llm },
      {
        intent: "direct_edit",
        action: "chat_only",
        confidence: 1,
        source: "heuristic",
      },
    );

    const result = await runWithRequestUserAsync(USER_ID, () =>
      service.chat(SESSION_ID, "Explícame el benchmark", {
        activeTab: "benchmark",
        currentDbgaContent: dbgaBody,
      }),
    );

    assert.equal(result.documentHadDelimiter, true);
    assert.ok(result.session);
    const assistant = (result.session?.chatLog ?? [])
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");
    assert.ok(assistant?.content?.trim().length);
  });

  it("tab spec: parsea ---FIN_SPEC--- (delimitador detectado)", async () => {
    const specBody = [
      "# Spec",
      "",
      "## Requisitos",
      "",
      "Detalle funcional con alcance, actores y criterios de aceptación para contrato.",
    ].join("\n");
    const llm = docWithFin("SPEC", specBody);
    const service = buildSessionsService({ spec: llm });

    const result = await runWithRequestUserAsync(USER_ID, () =>
      service.chat(SESSION_ID, "Integra requisitos", {
        activeTab: "spec",
        currentSpecContent: "",
      }),
    );

    assert.equal(result.documentHadDelimiter, true);
    assert.ok(result.session);
    const assistant = (result.session?.chatLog ?? [])
      .slice()
      .reverse()
      .find((m) => m.role === "assistant");
    assert.ok(assistant?.content?.trim().length);
  });
});
