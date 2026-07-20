import {
  GOVERNANCE_TARGET_LABELS,
  GOVERNANCE_TARGETS_ORDER,
  normalizeGovernanceTargetAlias,
  parseAgentGovernanceScaffold,
  promptInicialFilename,
  type GovernanceTarget,
} from "@theforge/shared-types";
import { compactifyGovernanceResponse } from "../mcp-governance.util.js";
import { resolveGovernanceTarget } from "../mcp-client-context.js";
import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";

export const GENERATION_TOOLS: McpTool[] = [
  {
    name: "generate_benchmark",
    description: "Genera benchmark / análisis de mercado para un proyecto",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        userIdea: { type: "string", description: "Idea del usuario" },
        urls: { type: "array", items: { type: "string" }, description: "URLs de referencia" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "phase0_deep_research",
    description: "Ejecuta investigación profunda Fase 0: benchmark + DBGA",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        userIdea: { type: "string" },
        urls: { type: "array", items: { type: "string" } },
        includeBenchmark: { type: "boolean" },
      },
      required: ["projectId", "userIdea"],
    },
  },
  {
    name: "suggest_brd_tobe_from_dbga",
    description: "Genera borrador BRD desde DBGA (greenfield). Persiste en Stage.brdContent vía POST …/suggest-brd-from-dbga.",
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
    name: "generate_deliverables",
    description: "Cascada completa de entregables: SPEC, Arquitectura, Casos de uso, Historias, Blueprint, API, Infra, Tasks",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "generate_spec",
    description: "Genera el documento SPEC del proyecto",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "string" } },
      required: ["projectId"],
    },
  },
  {
    name: "generate_blueprint",
    description: "Genera el Implementation Blueprint",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: { type: "boolean", description: "Solo previsualizar" },
        gapsFeedback: { type: "string", description: "Feedback para cubrir gaps" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_architecture",
    description: "Genera el documento de arquitectura",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: { type: "boolean" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_api_contracts",
    description: "Genera los contratos de API",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: { type: "boolean" },
        gapsFeedback: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_use_cases",
    description: "Genera los casos de uso",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: { type: "boolean" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_user_stories",
    description: "Genera las historias de usuario",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: { type: "boolean" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_logic_flows",
    description: "Genera los flujos de lógica de negocio",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        gapsFeedback: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_infra",
    description: "Genera el documento de infraestructura",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: { type: "boolean" },
        gapsFeedback: { type: "string" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_agent_governance",
    description:
      "Genera el scaffold de Gobernanza IA (AGENTS.md, rules, skills, mcp.json.example) desde MDD + Blueprint + complejidad. " +
      "Persistencia canónica en docs/agent-governance/; el bundle multi-target se aplica en export. " +
      "Auto-detecta el cliente vía initialize; usa 'target' para forzar async/compact.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        preview: {
          type: "boolean",
          description: "Si true, no persiste; devuelve { content } con el JSON scaffold",
        },
        queue: {
          type: "boolean",
          description: "Si true y la cola de entregables está activa, encola el job async",
        },
        target: {
          type: "string",
          description:
            "IDE opcional: cursor, antigravity, claude-code, github-copilot, windsurf, openhands, codex, hermes " +
            "(aliases: gemini, devin, copilot). Afecta async/compact; persistencia siempre canónica.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_agent_governance_export",
    description:
      "Devuelve el scaffold de Gobernanza IA reconciliado con bundle multi-target (install-targets/, PROMPT-INICIAL.{ide}.md, MANIFEST.installMaps). " +
      "Opcional `target` filtra vista a un IDE; default = bundle completo.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        target: {
          type: "string",
          description:
            "IDE opcional: cursor, antigravity, claude-code, github-copilot, windsurf, openhands, codex, hermes. Sin target = bundle completo.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "generate_phase0",
    description:
      "Flujo completo de cero a primer borrador: crea proyecto (NEW), ejecuta análisis DBGA + deep research, genera MDD + BRD y los sube al proyecto. Retorna projectId con contenido listo para revisar y perfeccionar.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del proyecto" },
        idea: { type: "string", description: "Descripción de la idea u oportunidad de negocio" },
        urls: { type: "array", items: { type: "string" }, description: "URLs de referencia (opcional)" },
        hasUxTeam: { type: "boolean", description: "Equipo UX disponible (default: false)" },
      },
      required: ["name", "idea"],
    },
  },
];

export function createGenerationHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get: apiGet, post: apiPost, patch: apiPatch, delete: apiDelete, fetchAllowStatuses: apiFetchAllowStatuses } = api;
  return {
  async generate_benchmark(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/generate-benchmark`, {
        userIdea: args.userIdea ?? "",
        urls: (args.urls as string[]) ?? [],
      }),
    );
  },
  async phase0_deep_research(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/phase0-deep-research`, {
        userIdea: args.userIdea ?? "",
        urls: (args.urls as string[]) ?? [],
        includeBenchmark: args.includeBenchmark ?? false,
      }),
    );
  },
  async suggest_brd_tobe_from_dbga(args) {
    const body: Record<string, unknown> = {};
    if (args.stageId) body.stageId = args.stageId;
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/suggest-brd-from-dbga`, body));
  },
  async generate_deliverables(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/generate-deliverables`));
  },
  async generate_spec(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/generate-spec`));
  },
  async generate_blueprint(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/generate-blueprint`, {
      preview: args.preview ?? false,
      gapsFeedback: (args.gapsFeedback as string) ?? "",
    }));
  },
  async generate_architecture(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/generate-architecture`, {
      preview: args.preview ?? false,
    }));
  },
  async generate_api_contracts(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/generate-api-contracts`, {
        preview: args.preview ?? false,
        gapsFeedback: (args.gapsFeedback as string) ?? "",
      }),
    );
  },
  async generate_use_cases(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/generate-use-cases`, {
      preview: args.preview ?? false,
    }));
  },
  async generate_user_stories(args) {
    return JSON.stringify(await apiPost(`/projects/${args.projectId}/generate-user-stories`, {
      preview: args.preview ?? false,
    }));
  },
  async generate_logic_flows(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/generate-logic-flows`, {
        gapsFeedback: (args.gapsFeedback as string) ?? "",
      }),
    );
  },
  async generate_infra(args) {
    return JSON.stringify(
      await apiPost(`/projects/${args.projectId}/generate-infra`, {
        preview: args.preview ?? false,
        gapsFeedback: (args.gapsFeedback as string) ?? "",
      }),
    );
  },
  async generate_agent_governance(args) {
    const target = resolveGovernanceTarget(args.target as string | undefined);

    // OpenHands y Hermes timeoutan durante la generación LLM (30-90s).
    // Forzar queue async: respuesta instantánea (~100 bytes), polling con get_job_status.
    const needsAsync = target !== "cursor";
    const queue = needsAsync || args.queue === true ? "?queue=true" : "";

    const raw = await apiPost(`/projects/${args.projectId}/generate-agent-governance${queue}`, {
      preview: args.preview ?? false,
      target,
    });

    // Queue ya es compacto, y la respuesta completa se compacta también
    const needsCompact = target !== "cursor";
    const response = needsCompact
      ? compactifyGovernanceResponse(raw, args.projectId as string)
      : raw;

    return JSON.stringify(response);
  },
  async get_agent_governance_export(args) {
    const raw = await apiGet(`/projects/${args.projectId}/agent-governance-export`);
    const target = args.target as string | undefined;
    if (!target?.trim()) {
      return JSON.stringify(raw);
    }
    const resolved = normalizeGovernanceTargetAlias(target) as GovernanceTarget;
    const scaffoldRaw: string | Record<string, unknown> | null | undefined =
      (raw as { files?: unknown }).files != null
        ? (raw as Record<string, unknown>)
        : typeof (raw as { agentGovernance?: unknown }).agentGovernance === "string" ||
            (typeof (raw as { agentGovernance?: unknown }).agentGovernance === "object" &&
              (raw as { agentGovernance?: unknown }).agentGovernance != null)
          ? ((raw as { agentGovernance?: unknown }).agentGovernance as
              | string
              | Record<string, unknown>)
          : typeof raw === "string"
            ? raw
            : raw != null && typeof raw === "object"
              ? (raw as Record<string, unknown>)
              : null;
    const scaffold = parseAgentGovernanceScaffold(scaffoldRaw);
    if (!scaffold) return JSON.stringify(raw);
    const promptPath = promptInicialFilename(resolved);
    const bundlePrefix = `install-targets/${resolved}/`;
    const filtered = scaffold.files.filter(
      (f) =>
        f.path === promptPath ||
        f.path.startsWith(bundlePrefix) ||
        f.path.startsWith("docs/agent-governance/") ||
        f.path === "AGENTS.md" ||
        f.path === "PROMPT-INICIAL.md",
    );
    return JSON.stringify({
      target: resolved,
      label: GOVERNANCE_TARGET_LABELS[resolved],
      promptPath,
      availableTargets: GOVERNANCE_TARGETS_ORDER.map((t) => ({
        id: t,
        label: GOVERNANCE_TARGET_LABELS[t],
        prompt: promptInicialFilename(t),
      })),
      manifest: scaffold.manifest,
      files: filtered,
    });
  },
  async generate_phase0(args) {
    const name = args.name as string;
    const idea = args.idea as string;
    const urls = (args.urls as string[]) ?? [];
    const hasUxTeam = (args.hasUxTeam as boolean) ?? false;

    // Step 1: Crear proyecto NEW
    console.error("[theforge-mcp] [generate_phase0] Paso 1: Creando proyecto...");
    const project = await apiPost("/projects", {
      name,
      projectType: "NEW",
      hasUxTeam,
    }) as { id: string };
    const projectId = project.id;

    // Step 2: Iniciar análisis DBGA
    console.error("[theforge-mcp] [generate_phase0] Paso 2: Iniciando DBGA...");
    await apiPost("/ai-analysis/start", { idea, projectId });

    // Step 3: Deep research + MDD generation
    console.error("[theforge-mcp] [generate_phase0] Paso 3: Deep research + MDD...");
    const deepResult = await apiPost(`/projects/${projectId}/phase0-deep-research`, {
      userIdea: idea,
      urls,
      includeBenchmark: true,
    }) as Record<string, unknown>;

    // Step 3b: Sync phase0SummaryContent → dbgaContent (el deep research guarda en phase0, pero suggest-brd-from-dbga lee dbga)
    console.error("[theforge-mcp] [generate_phase0] Paso 3b: Sincronizando phase0 → dbgaContent...");
    const projectBeforeSync = await apiGet(`/projects/${projectId}`) as Record<string, unknown>;
    const phase0 = (projectBeforeSync.phase0SummaryContent as string || "").trim();
    const dbga = (projectBeforeSync.dbgaContent as string || "").trim();
    if (phase0.length >= 300 && dbga.length < 300) {
      await apiPatch(`/projects/${projectId}`, { dbgaContent: phase0 });
      console.error("[theforge-mcp] [generate_phase0] dbgaContent actualizado desde phase0SummaryContent");
    }

    // Step 4: Generar BRD desde DBGA (persiste en Stage.brdContent)
    console.error("[theforge-mcp] [generate_phase0] Paso 4: Generando BRD...");
    const brdResult = await apiPost(`/projects/${projectId}/suggest-brd-from-dbga`) as Record<string, unknown>;

    // Step 5: Verificar MDD (proyecto) y BRD (etapa)
    console.error("[theforge-mcp] [generate_phase0] Paso 5: Obteniendo contenido generado...");
    const [fullProject, stagesResult] = await Promise.all([
      apiGet(`/projects/${projectId}`) as Promise<Record<string, unknown>>,
      apiGet(`/projects/${projectId}/stages`) as Promise<{ stages?: Array<{ brdContent?: string | null }> }>,
    ]);
    const brdPersisted = (stagesResult.stages ?? []).some(
      (s) => (s.brdContent ?? "").trim().length > 0,
    );

    const summary = {
      projectId,
      projectName: name,
      deepResearch: deepResult ?? "completed",
      brd: brdResult ?? "completed",
      mddContent: fullProject.mddContent ? "generado ✓" : "no generado",
      brdContent: brdPersisted ? "generado ✓" : "no generado",
      message: "MDD y BRD generados. Revisa y perfecciona en la UI.",
    };

    return JSON.stringify(summary);
  },
  };
}
