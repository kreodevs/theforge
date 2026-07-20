import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";

export const ANALYSIS_TOOLS: McpTool[] = [
  {
    name: "get_job_status",
    description:
      "Consulta el estado de un job asíncrono de generación (blueprint, agent-governance, etc.). Usar después de generate_agent_governance con queue=true para saber cuándo terminó.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        jobId: { type: "string", description: "ID del job devuelto por generate_agent_governance (o cualquier endpoint con ?queue=true)" },
      },
      required: ["projectId", "jobId"],
    },
  },
  {
    name: "confirm_complexity",
    description: "Confirma la complejidad propuesta del proyecto",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "reassess_complexity",
    description: "Re-evalúa la complejidad del proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        note: { type: "string", description: "Nota opcional para contextualizar" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "start_analysis",
    description: "Inicia un análisis DBGA (Domain-Based Goal Analysis) desde una idea",
    inputSchema: {
      type: "object",
      properties: {
        idea: { type: "string", description: "La idea del proyecto a analizar" },
        projectId: { type: "string", description: "ID del proyecto opcional (para persistir estado)" },
      },
      required: ["idea"],
    },
  },
  {
    name: "get_estimation",
    description: "Métricas de estimación: semáforo + horas + costo MXN",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        stageId: { type: "string", description: "ID de etapa opcional" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_mdd_thread",
    description: "Obtiene el threadId del flujo MDD activo",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        stageId: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_adrs",
    description: "Decisiones arquitectónicas (ADRs) del proyecto",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "review_mdd",
    description: "Revisa consistencia del MDD y re-deriva diagramas",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        mddContent: { type: "string", description: "Contenido MDD opcional" },
      },
      required: ["projectId"],
    },
  },
];

export function createAnalysisHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete, fetchAllowStatuses: apiFetchAllowStatuses } = api;
  return {
  async get_job_status(args) {
    return JSON.stringify(
      await apiGet(`/projects/${args.projectId}/deliverables-jobs/${args.jobId}`),
    );
  },
  async confirm_complexity(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/confirm-complexity`));
  },
  async reassess_complexity(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/reassess-complexity`, {
        note: (args.note as string) ?? "",
      }),
    );
  },
  async start_analysis(args) {
    const body: Record<string, unknown> = { idea: args.idea };
    if (args.projectId) body.projectId = args.projectId;
    return JSON.stringify(await apiPost("/ai-analysis/start", body));
  },
  async get_estimation(args) {
    let path = `/ai-analysis/estimation?projectId=${args.projectId}`;
    if (args.stageId) path += `&stageId=${args.stageId}`;
    return JSON.stringify(await apiGet(path));
  },
  async get_mdd_thread(args) {
    let path = `/ai-analysis/mdd/thread?projectId=${args.projectId}`;
    if (args.stageId) path += `&stageId=${args.stageId}`;
    return JSON.stringify(await apiGet(path));
  },
  async get_adrs(args) {
    return JSON.stringify(await apiGet(`/ai-analysis/mdd/adrs?projectId=${args.projectId}`));
  },
  async review_mdd(args) {
    const body: Record<string, unknown> = { projectId: args.projectId };
    if (args.mddContent) body.mddContent = args.mddContent;
    return JSON.stringify(await apiPost("/ai-analysis/mdd/review", body));
  },
  };
}
