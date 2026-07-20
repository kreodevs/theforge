import type { McpApiClient, McpHandler, McpTool } from "../mcp-tool.types.js";
import { createProjectGroupHandlers } from "../project-group-tools.js";
import { createProjectStageHandlers } from "../project-stage-tools.js";
import { ANALYSIS_TOOLS, createAnalysisHandlers } from "./analysis.tools.js";
import { GENERATION_TOOLS, createGenerationHandlers } from "./generation.tools.js";
import { INTEGRATION_TOOLS, createIntegrationHandlers } from "./integration.tools.js";
import { LEGACY_TOOLS, createLegacyHandlers } from "./legacy.tools.js";
import { MARKDOWN_TOOLS, createMarkdownHandlers } from "./markdown.tools.js";
import { ORCHESTRATOR_TOOLS, createOrchestratorHandlers } from "./orchestrator.tools.js";
import { PROJECT_TOOLS, createProjectHandlers } from "./project.tools.js";

/** Manifiesto MCP completo: dominios core + grupos + etapas (incluidos en PROJECT_TOOLS). */
export function buildMcpTools(): McpTool[] {
  return [
    ...PROJECT_TOOLS,
    ...GENERATION_TOOLS,
    ...ANALYSIS_TOOLS,
    ...ORCHESTRATOR_TOOLS,
    ...LEGACY_TOOLS,
    ...INTEGRATION_TOOLS,
    ...MARKDOWN_TOOLS,
  ];
}

/** Mapa nombre → handler async (JSON string). */
export function buildMcpHandlers(api: McpApiClient): Record<string, McpHandler> {
  const { get, post, patch, delete: del } = api;
  return {
    ...createProjectHandlers(api),
    ...createGenerationHandlers(api),
    ...createAnalysisHandlers(api),
    ...createOrchestratorHandlers(api),
    ...createLegacyHandlers(api),
    ...createIntegrationHandlers(api),
    ...createMarkdownHandlers(api),
    ...createProjectGroupHandlers({ get, post, patch, delete: del }),
    ...createProjectStageHandlers({ get, post, patch }),
  };
}
