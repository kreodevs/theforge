import { summarizeAgentGovernanceField } from "../mcp-governance.util.js";
import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";
import { PROJECT_GROUP_TOOLS } from "../project-group-tools.js";
import { PROJECT_STAGE_TOOLS } from "../project-stage-tools.js";

export const PROJECT_TOOLS: McpTool[] = [
  {
    name: "list_projects",
    description: "Lista todos los proyectos registrados en TheForge",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_project",
    description: "Obtiene un proyecto por su ID",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string", description: "ID del proyecto" } },
      required: ["projectId"],
    },
  },
  {
    name: "create_project",
    description: "Crea un nuevo proyecto (NEW=greenfield, LEGACY=existente)",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del proyecto" },
        projectType: { type: "string", enum: ["NEW", "LEGACY"], description: "Tipo de proyecto" },
        hasUxTeam: { type: "boolean", description: "Equipo UX disponible" },
        theforgeProjectId: { type: "string", description: "UUID del proyecto en TheForge/Ariadne (requerido si LEGACY)" },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_project",
    description: "Elimina un proyecto",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "get_project_deliverables",
    description:
      "Devuelve un resumen estructurado de todos los documentos de la cascada (Spec, Blueprint, API Contracts, Architecture, Use Cases, User Stories, Logic Flows, Infra, UX/UI Guide, DBGA, Agent Governance). Cada doc incluye 'exists', 'wordCount' y 'content' completo si existe. agentGovernanceContent es JSON scaffold (rules/skills/AGENTS.md). Los docs de stage (BRD, To-Be, As-Is, MDD) están en get_project_stages.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string", description: "ID del proyecto" } },
      required: ["projectId"],
    },
  },
  {
    name: "get_project_stages",
    description: "Lista las etapas (stages) de un proyecto. Incluye projectDocuments (resumen de documentos de la cascada del Project).",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "get_conformance",
    description: "Reporte de conformidad del proyecto contra el MDD",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        useLlm: { type: "boolean", description: "Usar LLM para el análisis" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "audit_documents",
    description:
      "Auditoría integral de calidad documental: conformidad heurística (y opcional LLM), resumen API/Infra/Blueprint/Flujos y gaps SDD transversales.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        useLlm: { type: "boolean", description: "Incluir conformidad con LLM además de heurística" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "patch_project",
    description: "Actualiza campos del proyecto (mddContent, dbgaContent, blueprintContent, groupId, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        fields: {
          type: "object",
          description: "Campos a actualizar (mddContent, dbgaContent, blueprintContent, specContent, groupId, etc.)",
          additionalProperties: true,
        },
      },
      required: ["projectId", "fields"],
    },
  },
  ...PROJECT_STAGE_TOOLS,
  ...PROJECT_GROUP_TOOLS,
];

export function createProjectHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete, fetchAllowStatuses: apiFetchAllowStatuses } = api;
  return {
  async list_projects() {
    return JSON.stringify(await apiGet("/projects"));
  },
  async get_project(args) {
    return JSON.stringify(await apiGet(`/projects/${args.projectId}`));
  },
  async create_project(args) {
    return JSON.stringify(
      await apiPost("/projects", {
        name: args.name,
        projectType: args.projectType ?? "NEW",
        hasUxTeam: args.hasUxTeam ?? false,
        theforgeProjectId: args.theforgeProjectId ?? undefined,
      }),
    );
  },
  async delete_project(args) {
    return JSON.stringify(await apiDelete(`/projects/${args.projectId}`));
  },
  async get_project_deliverables(args) {
    const projectId = args.projectId as string;
    const project = await apiGet(`/projects/${projectId}`) as Record<string, unknown>;
    const docFields: { key: string; label: string }[] = [
      { key: "specContent", label: "Spec" },
      { key: "architectureContent", label: "Architecture" },
      { key: "blueprintContent", label: "Blueprint" },
      { key: "apiContractsContent", label: "API Contracts" },
      { key: "useCasesContent", label: "Use Cases" },
      { key: "userStoriesContent", label: "User Stories" },
      { key: "logicFlowsContent", label: "Logic Flows" },
      { key: "infraContent", label: "Infrastructure" },
      { key: "tasksContent", label: "Tasks" },
      { key: "uxUiGuideContent", label: "UX/UI Guide" },
      { key: "uiScreensContent", label: "Pantallas / UI Screens" },
      { key: "dbgaContent", label: "DBGA" },
      { key: "phase0SummaryContent", label: "Phase 0 Summary" },
      { key: "aemContent", label: "AEM" },
      { key: "agentGovernanceContent", label: "Agent Governance / Gobernanza IA" },
    ];
    const deliverables: Record<string, { label: string; exists: boolean; wordCount: number; content: string | null }> = {};
    for (const { key, label } of docFields) {
      const content = project[key];
      if (key === "agentGovernanceContent") {
        const summary = summarizeAgentGovernanceField(content);
        deliverables[key] = { label, ...summary };
        continue;
      }
      const text = typeof content === "string" ? content : "";
      deliverables[key] = {
        label,
        exists: text.trim().length > 0,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        content: text.trim().length > 0 ? text : null,
      };
    }
    return JSON.stringify({
      projectId,
      projectName: project.name ?? null,
      deliverables,
      totalDocs: Object.values(deliverables).filter((d) => d.exists).length,
      note: "Los documentos de stage (BRD, To-Be, As-Is, MDD) están en get_project_stages, no en este tool.",
    });
  },
  async get_project_stages(args) {
    const projectId = args.projectId as string;
    const [stagesResult, projectResult] = await Promise.all([
      apiGet(`/projects/${projectId}/stages`),
      apiGet(`/projects/${projectId}`).catch(() => null),
    ]);
    const result = stagesResult as Record<string, unknown>;
    // Attach project document summary so agents see what cascade docs exist
    if (projectResult && typeof projectResult === "object") {
      const p = projectResult as Record<string, unknown>;
      const docFields = [
        "specContent", "architectureContent", "blueprintContent",
        "apiContractsContent", "useCasesContent", "userStoriesContent",
        "logicFlowsContent", "infraContent", "tasksContent",
        "uxUiGuideContent", "dbgaContent", "phase0SummaryContent",
        "aemContent", "agentGovernanceContent",
      ];
      const projectDocuments: Record<string, { exists: boolean; wordCount: number }> = {};
      for (const field of docFields) {
        const content = p[field];
        if (field === "agentGovernanceContent") {
          const summary = summarizeAgentGovernanceField(content);
          projectDocuments[field] = {
            exists: summary.exists,
            wordCount: summary.wordCount,
          };
          continue;
        }
        const text = typeof content === "string" ? content : "";
        projectDocuments[field] = {
          exists: text.trim().length > 0,
          wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
        };
      }
      (result as any).projectDocuments = projectDocuments;
    }
    return JSON.stringify(result);
  },
  async get_conformance(args) {
    return JSON.stringify(
      await apiGet(`/projects/${args.projectId}/conformance?useLlm=${args.useLlm === true ? "true" : "false"}`),
    );
  },
  async audit_documents(args) {
    return JSON.stringify(
      await apiGet(
        `/projects/${args.projectId}/audit-documents?useLlm=${args.useLlm === true ? "true" : "false"}`,
      ),
    );
  },
  async patch_project(args) {
    const { projectId, fields } = args as { projectId: string; fields: Record<string, unknown> };
    return JSON.stringify(await apiPatch(`/projects/${projectId}`, fields));
  },
  };
}
