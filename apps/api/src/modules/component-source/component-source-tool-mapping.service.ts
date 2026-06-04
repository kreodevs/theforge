import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  inferCapabilitiesFromMapping,
  type ComponentSourceRole,
  type ComponentSourceToolMapping,
} from "@theforge/component-source";
import { DEFAULT_MCP_TOOL_MAPPING } from "@theforge/component-source-mcp";
import type { McpToolDefinition } from "@theforge/component-source-mcp";
import { z } from "zod";
import { AiService } from "../ai/ai.service.js";
import { parseJsonOrThrow } from "../ai-analysis/utils/parse-json.js";
import {
  isDisallowedCatalogListTool,
  resolveCatalogListToolName,
} from "./catalog-list-tool.util.js";

const COMPONENT_SOURCE_ROLES: ComponentSourceRole[] = [
  "catalog.list",
  "catalog.search",
  "catalog.resolve",
  "catalog.get",
  "catalog.props",
  "catalog.recipe",
  "catalog.health",
  "designSystem.get",
  "designSystem.styleRules",
  "preview.single",
  "preview.batch",
];

const mappedToolSchema = z.object({
  toolName: z.string().min(1),
  description: z.string().optional(),
});

const toolMappingSchema = z
  .object({
    "catalog.list": mappedToolSchema,
  })
  .catchall(mappedToolSchema.optional());

export interface ProposeToolMappingOptions {
  hints?: string;
  /** Prior mapping to bias the LLM when tools were renamed but roles unchanged. */
  previousMapping?: ComponentSourceToolMapping | null;
}

const SYSTEM_PROMPT = `Eres un experto en integración MCP para catálogos de design system.

Tu tarea: mapear roles internos de The Forge a nombres reales de herramientas MCP.

Roles internos (claves JSON obligatorias cuando exista herramienta equivalente):
- catalog.list (OBLIGATORIO — debe mapearse siempre)
- catalog.search, catalog.resolve, catalog.get, catalog.props, catalog.recipe, catalog.health
- designSystem.get, designSystem.styleRules
- preview.single, preview.batch

Responde SOLO con un objeto JSON válido (sin markdown ni texto extra).
Cada rol presente debe tener { "toolName": "<nombre exacto en tools/list>", "description": "..." }.
Usa únicamente nombres que existan en la lista de herramientas proporcionada.
Si no hay herramienta equivalente para un rol opcional, omite esa clave.
NUNCA omitas catalog.list si existe alguna herramienta de listado/catálogo.
NUNCA mapees catalog.list a herramientas de documentación o búsqueda en repos (p. ej. fetch_*_documentation, search_*_documentation, search_*_code de GitMCP). Esas tools devuelven markdown o resultados de búsqueda, no un catálogo JSON con ids de módulos.
catalog.list debe apuntar solo a tools que listen componentes/módulos del design system (list_modules, list_components, catalog, etc.).`;

@Injectable()
export class ComponentSourceToolMappingService {
  private readonly logger = new Logger(ComponentSourceToolMappingService.name);

  constructor(private readonly ai: AiService) {}

  async proposeMapping(
    tools: McpToolDefinition[],
    options: ProposeToolMappingOptions = {},
  ): Promise<ComponentSourceToolMapping> {
    const toolNames = tools.map((t) => t.name);
    const toolsJson = JSON.stringify(
      tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema ?? null,
      })),
      null,
      2,
    );

    const hintsBlock = options.hints?.trim()
      ? `\n\nPistas del operador:\n${options.hints.trim()}`
      : "";
    const previousBlock = options.previousMapping
      ? `\n\nMapeo anterior (referencia; adapta a tools/list actual):\n${JSON.stringify(options.previousMapping, null, 2)}`
      : "";

    const defaultNames = Object.fromEntries(
      COMPONENT_SOURCE_ROLES.map((role) => [role, DEFAULT_MCP_TOOL_MAPPING[role]?.toolName ?? ""]),
    );

    const userPrompt = `Herramientas MCP disponibles (tools/list):
${toolsJson}

Nombres de herramientas: ${toolNames.join(", ")}

Convención IMJ/Orbita habitual (solo referencia): ${JSON.stringify(defaultNames)}${previousBlock}${hintsBlock}

Devuelve el JSON de mapeo role → { toolName, description? }.`;

    const raw = await this.ai.generateResponse(userPrompt, [], {
      systemPrompt: SYSTEM_PROMPT,
    });

    let parsed: ComponentSourceToolMapping;
    try {
      parsed = parseJsonOrThrow(raw, toolMappingSchema) as ComponentSourceToolMapping;
    } catch (err) {
      this.logger.warn(
        `LLM mapping parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        "No se pudo interpretar el mapeo propuesto por el LLM. Reintenta la conexión.",
      );
    }

    return this.validateAndNormalize(parsed, toolNames);
  }

  /** Applies catalog.list heuristics before schema validation (doc/search tools are rejected). */
  applyCatalogListHeuristic(
    mapping: ComponentSourceToolMapping,
    availableToolNames: string[],
  ): ComponentSourceToolMapping {
    const resolved = resolveCatalogListToolName(
      mapping["catalog.list"]?.toolName,
      availableToolNames,
    );
    if (!resolved.ok) {
      throw new BadRequestException(resolved.reason);
    }
    if (resolved.correctedFrom) {
      this.logger.warn(
        `catalog.list corregido: "${resolved.correctedFrom}" → "${resolved.toolName}"`,
      );
    }
    return {
      ...mapping,
      "catalog.list": {
        ...mapping["catalog.list"],
        toolName: resolved.toolName,
      },
    };
  }

  validateAndNormalize(
    mapping: ComponentSourceToolMapping,
    availableToolNames: string[],
  ): ComponentSourceToolMapping {
    const withCatalog = this.applyCatalogListHeuristic(mapping, availableToolNames);
    const listTool = withCatalog["catalog.list"]?.toolName?.trim();
    if (!listTool) {
      throw new BadRequestException(
        "El mapeo debe incluir catalog.list con toolName. No se encontró herramienta de listado en el MCP.",
      );
    }

    const available = new Set(availableToolNames);
    if (!available.has(listTool)) {
      throw new BadRequestException(
        `catalog.list apunta a "${listTool}" pero esa herramienta no está en tools/list.`,
      );
    }

    if (isDisallowedCatalogListTool(listTool)) {
      throw new BadRequestException(
        `catalog.list no puede usar "${listTool}": es documentación o búsqueda en repo, no un catálogo de módulos DS.`,
      );
    }

    const normalized: ComponentSourceToolMapping = {
      "catalog.list": {
        toolName: listTool,
        description: withCatalog["catalog.list"]?.description,
      },
    };

    for (const role of COMPONENT_SOURCE_ROLES) {
      if (role === "catalog.list") continue;
      const entry = withCatalog[role];
      const toolName = entry?.toolName?.trim();
      if (!toolName) continue;
      if (!available.has(toolName)) {
        this.logger.warn(`Omitting role ${role}: tool "${toolName}" not in tools/list`);
        continue;
      }
      normalized[role] = {
        toolName,
        ...(entry?.description ? { description: entry.description } : {}),
      };
    }

    return normalized;
  }

  inferCapabilities(mapping: ComponentSourceToolMapping) {
    return inferCapabilitiesFromMapping(mapping);
  }
}
