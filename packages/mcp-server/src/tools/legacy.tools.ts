import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";

export const LEGACY_TOOLS: McpTool[] = [
  {
    name: "legacy_start",
    description: "Inicia flujo legacy: envía descripción a AriadneSpecs para obtener archivos y preguntas",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto (debe ser tipo LEGACY)" },
        description: { type: "string", description: "Descripción de la modificación deseada" },
      },
      required: ["projectId", "description"],
    },
  },
  {
    name: "legacy_answer",
    description: "Responde preguntas del flujo legacy",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        answers: {
          type: "object",
          description: "Mapa índice → respuesta (ej. { \"0\": \"10\", \"1\": \"30\" })",
          additionalProperties: { type: "string" },
        },
      },
      required: ["projectId", "answers"],
    },
  },
  {
    name: "legacy_generate_mdd",
    description:
      "Genera MDD legacy (persiste en stage). Respuesta ligera por defecto; includeContent=true devuelve markdown completo.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        stageId: { type: "string" },
        includeContent: {
          type: "boolean",
          description: "Si true, añade ?includeContent=true (respuesta grande; preferir get_project después)",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "legacy_generate_codebase_doc",
    description: "Genera documentación del codebase vía AriadneSpecs MCP",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        responseMode: {
          type: "string",
          enum: ["default", "evidence_first", "raw_evidence", "ingest_mdd"],
          description: "Modo de generación: default (descubrimiento escalonado), evidence_first, raw_evidence, ingest_mdd (MDD completo del orquestador)",
        },
        stageId: { type: "string", description: "ID de etapa opcional" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "legacy_generate_deliverables",
    description: "Cascada de entregables del flujo legacy",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "legacy_update_codebase_doc",
    description: "Actualiza manualmente la documentación del codebase",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        codebaseDoc: { type: "string", description: "Contenido Markdown" },
      },
      required: ["projectId", "codebaseDoc"],
    },
  },
  {
    name: "legacy_generate_as_is_manual",
    description: "Genera mapa As-Is desde codebaseDoc",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "legacy_suggest_brd_tobe",
    description: "Genera borrador BRD desde codebaseDoc (legacy). Persiste en Stage.brdContent vía POST …/legacy/suggest-brd-from-codebase-doc.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "legacy_resolve_index_sdd_conflict",
    description: "Resuelve conflicto entre índice MCP y SDD",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        choice: {
          type: "string",
          enum: ["trust_index", "trust_sdd", "proceed_with_warnings"],
          description: "Cómo resolver el conflicto",
        },
      },
      required: ["projectId", "choice"],
    },
  },
  {
    name: "legacy_interview_start",
    description: "Inicia entrevista conversacional legacy: envía descripción, recibe preguntas contextuales basadas en navigation map del proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto (debe ser tipo LEGACY)" },
        description: { type: "string", description: "Descripción del cambio en lenguaje natural" },
        stageId: { type: "string", description: "ID de etapa opcional para persistir resultado" },
      },
      required: ["projectId", "description"],
    },
  },
  {
    name: "legacy_interview_chat",
    description: "Continúa la entrevista conversacional: envía mensaje del usuario y recibe respuesta con preguntas contextuales",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID del start" },
        message: { type: "string", description: "Mensaje del usuario" },
      },
      required: ["sessionId", "message"],
    },
  },
  {
    name: "legacy_interview_confirm",
    description: "Confirma y persiste el ChangeScope de la entrevista actual",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID del start" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "legacy_interview_status",
    description: "Obtiene el estado actual de la entrevista: mensajes, ChangeScope y rutas afectadas",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Session ID del start" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "legacy_resolve_change_to_files",
    description: "Dada una descripción de cambio, resuelve los archivos exactos a modificar usando el navigation map del proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto" },
        description: { type: "string", description: "Descripción del cambio" },
        stageId: { type: "string", description: "Etapa base opcional" },
      },
      required: ["projectId", "description"],
    },
  },
  {
    name: "legacy_check_navigation_impact",
    description: "Evalúa si modificar un componente afecta múltiples rutas en el mapa de navegación. Detecta componentes compartidos",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto" },
        componentPath: { type: "string", description: "Ruta del componente a modificar (ej. src/shared/AddressForm.tsx)" },
        stageId: { type: "string", description: "Etapa base opcional" },
      },
      required: ["projectId", "componentPath"],
    },
  },
  {
    name: "legacy_transition_status",
    description: "Verifica si un proyecto NEW puede transicionar a flujo legacy (consulta AriadneSpecs para saber si el código está indexado)",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "legacy_execute_transition",
    description: "Ejecuta la transición a flujo legacy: crea stage baseline con navigation map inicial del código existente",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "ID del proyecto" },
      },
      required: ["projectId"],
    },
  },
];

export function createLegacyHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete, fetchAllowStatuses: apiFetchAllowStatuses } = api;
  return {
  async legacy_start(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/legacy/start`, {
        description: args.description,
      }),
    );
  },
  async legacy_answer(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/legacy/answer`, {
        answers: args.answers,
      }),
    );
  },
  async legacy_generate_mdd(args) {
    const query = args.includeContent === true ? "?includeContent=true" : "";
    const body: Record<string, unknown> = {};
    if (args.stageId) body.stageId = args.stageId;
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/legacy/generate-mdd${query}`, body),
    );
  },
  async legacy_generate_codebase_doc(args) {
    const body: Record<string, unknown> = {};
    if (args.responseMode !== undefined) body.responseMode = args.responseMode;
    if (args.stageId !== undefined) body.stageId = args.stageId;
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/legacy/generate-codebase-doc`, body),
    );
  },
  async legacy_generate_deliverables(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/generate-deliverables`));
  },
  async legacy_update_codebase_doc(args) {
    return JSON.stringify(
      await apiPatch(`/projects/${args.projectId}/legacy/codebase-doc`, {
        codebaseDoc: args.codebaseDoc,
      }),
    );
  },
  async legacy_generate_as_is_manual(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/generate-as-is-manual`));
  },
  async legacy_suggest_brd_tobe(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/suggest-brd-from-codebase-doc`));
  },
  async legacy_resolve_index_sdd_conflict(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/legacy/resolve-index-sdd-conflict`, {
        choice: args.choice,
      }),
    );
  },
  async legacy_interview_start(args) {
    const body: Record<string, unknown> = { description: args.description };
    if (args.stageId !== undefined) body.stageId = args.stageId;
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/interview/start`, body));
  },
  async legacy_interview_chat(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/legacy/interview/${args.sessionId}/chat`, {
        message: args.message,
      }),
    );
  },
  async legacy_interview_confirm(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/interview/${args.sessionId}/confirm`));
  },
  async legacy_interview_status(args) {
    return JSON.stringify(await apiGet(`/projects/${args.projectId}/legacy/interview/${args.sessionId}`));
  },
  async legacy_resolve_change_to_files(args) {
    const body: Record<string, unknown> = { description: args.description };
    if (args.stageId !== undefined) body.stageId = args.stageId;
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/resolve-change-to-files`, body));
  },
  async legacy_check_navigation_impact(args) {
    const body: Record<string, unknown> = { componentPath: args.componentPath };
    if (args.stageId !== undefined) body.stageId = args.stageId;
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/check-navigation-impact`, body));
  },
  async legacy_transition_status(args) {
    return JSON.stringify(await apiGet(`/projects/${args.projectId}/legacy/transition-status`));
  },
  async legacy_execute_transition(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/legacy/execute-transition`));
  },
  };
}
