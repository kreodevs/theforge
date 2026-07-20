import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";

export const ORCHESTRATOR_TOOLS: McpTool[] = [
  {
    name: "orchestrator_chat",
    description: "Chat con el orquestador IA con contexto completo del proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        message: { type: "string", description: "Mensaje del usuario" },
        sessionId: { type: "string" },
        mddContent: { type: "string" },
        activeTab: { type: "string" },
        stageId: { type: "string" },
        dbgaContent: { type: "string" },
        uxUiGuideContent: { type: "string" },
        brdContent: { type: "string" },
        toBeManualContent: { type: "string" },
      },
      required: ["projectId", "message"],
    },
  },
  {
    name: "orchestrator_welcome",
    description: "Mensaje de bienvenida del orquestador para un proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sessionId: { type: "string" },
        activeTab: { type: "string" },
        stageId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "orchestrator_clear_chat",
    description: "Limpia el historial de chat del proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        sessionId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_session",
    description: "Crea una nueva sesión de chat en un proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        title: { type: "string", description: "Título de la sesión" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_project_sessions",
    description: "Lista las sesiones de un proyecto",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "get_session",
    description: "Obtiene una sesión por ID",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
    },
  },
  {
    name: "chat_in_session",
    description: "Envía un mensaje en una sesión existente con contexto completo",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        message: { type: "string" },
        activeTab: { type: "string" },
        stageId: { type: "string" },
        mddContent: { type: "string" },
      },
      required: ["sessionId", "message"],
    },
  },
];

export function createOrchestratorHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete, fetchAllowStatuses: apiFetchAllowStatuses } = api;
  return {
  async orchestrator_chat(args) {
    return JSON.stringify(
      await apiPost("/ai-orchestrator/chat", {
        projectId: args.projectId,
        message: args.message,
        sessionId: (args.sessionId as string) ?? "",
        mddContent: (args.mddContent as string) ?? null,
        activeTab: (args.activeTab as string) ?? "",
        stageId: (args.stageId as string) ?? "",
        dbgaContent: (args.dbgaContent as string) ?? null,
        uxUiGuideContent: (args.uxUiGuideContent as string) ?? null,
        brdContent: (args.brdContent as string) ?? null,
        toBeManualContent: (args.toBeManualContent as string) ?? null,
      }),
    );
  },
  async orchestrator_welcome(args) {
    return JSON.stringify(
      await apiPost("/ai-orchestrator/welcome", {
        projectId: args.projectId,
        sessionId: (args.sessionId as string) ?? "",
        activeTab: (args.activeTab as string) ?? "",
        stageId: (args.stageId as string) ?? "",
      }),
    );
  },
  async orchestrator_clear_chat(args) {
    return JSON.stringify(
      await apiPost("/ai-orchestrator/clear-chat", {
        projectId: args.projectId,
        sessionId: (args.sessionId as string) ?? "",
      }),
    );
  },
  async create_session(args) {
    return JSON.stringify(
      await apiPost("/sessions", {
        projectId: args.projectId,
        title: (args.title as string) ?? "Nueva sesión",
      }),
    );
  },
  async get_project_sessions(args) {
    return JSON.stringify(await apiGet(`/sessions/project/${args.projectId}`));
  },
  async get_session(args) {
    return JSON.stringify(await apiGet(`/sessions/${args.sessionId}`));
  },
  async chat_in_session(args) {
    return JSON.stringify(
      await apiPost(`/sessions/${args.sessionId}/chat`, {
        message: args.message,
        activeTab: (args.activeTab as string) ?? "",
        stageId: (args.stageId as string) ?? "",
        mddContent: (args.mddContent as string) ?? null,
      }),
    );
  },
  };
}
