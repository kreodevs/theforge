import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { COMPONENT_MAPPER_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";
import { componentMappingSchema, type WireframesStateType } from "../state/index.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";
import {
  expandWireframeResolveQueries,
  extractCatalogModuleIds,
  fuzzyMatchModuleWithAliases,
  parseResolveComponentsText,
  reconcileComponentMappings,
  resolutionToModuleId,
  unwrapMcpToolText,
  validateCatalogListText,
} from "../utils/wireframes-mcp-resolve.util.js";
import { formatDesignSystemContextBlock } from "../utils/wireframe-design-system-context.util.js";
import type { ComponentSourcePort, McpToolResult } from "@theforge/component-source";

const componentMapperOutputSchema = z.object({
  componentMappings: z.array(componentMappingSchema),
});

const MAX_TOOL_LOOPS = 10;

/** Coerce LLM output where compositionRecipe arrives as object instead of string. */
function normalizeComponentMapperJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as { componentMappings?: unknown[] };
  if (!Array.isArray(obj.componentMappings)) return raw;
  return {
    ...obj,
    componentMappings: obj.componentMappings.map((item) => {
      if (!item || typeof item !== "object") return item;
      const mapping = { ...(item as Record<string, unknown>) };
      const recipe = mapping.compositionRecipe;
      if (recipe != null && typeof recipe === "object") {
        mapping.compositionRecipe = JSON.stringify(recipe);
      }
      return mapping;
    }),
  };
}

function parseComponentMapperOutput(content: string): z.infer<typeof componentMapperOutputSchema> {
  const parsed = parseJsonOrThrow(content, z.unknown());
  return componentMapperOutputSchema.parse(normalizeComponentMapperJson(parsed));
}

function buildToolsByName(tools: StructuredToolInterface[]): Record<string, StructuredToolInterface> {
  const byName: Record<string, StructuredToolInterface> = {};
  for (const t of tools) byName[t.name] = t;
  return byName;
}

function unwrapMcpResult(result: McpToolResult): string {
  const isError = (result as unknown as Record<string, unknown>).isError === true;
  const texts = result.content
    ?.filter((c) => c.type === "text" && c.text)
    .map((c) => c.text) ?? [];
  const payload = texts.join("\n") || JSON.stringify(result);
  return isError ? `[MCP_ERROR] ${payload}` : payload;
}

function extractAIContent(msg: AIMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b): b is { type: "text"; text: string } =>
        typeof b === "object" && b !== null && "type" in b && b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

/** Creates DynamicStructuredTool wrappers around ComponentSourcePort methods (only mapped capabilities). */
export function createComponentMcpTools(
  componentSource: ComponentSourcePort,
  userId: string,
): DynamicStructuredTool[] {
  const caps = componentSource.capabilities;
  const logTool = (name: string, args: Record<string, unknown>, text: string) => {
    console.log(`\x1b[35m[Wireframes/MCP] ${name}(${JSON.stringify(args)}) → ${text.slice(0, 300)}\x1b[0m`);
  };

  const tools: DynamicStructuredTool[] = [];

  if (caps?.catalog?.search) {
    tools.push(
      new DynamicStructuredTool({
        name: "search_modules",
        description: "Busca módulos en el design system por query. Devuelve JSON con array 'hits'.",
        schema: z.object({ query: z.string().describe("Término de búsqueda") }),
        func: async ({ query }) => {
          const result = await componentSource.searchModules(userId, query);
          const text = unwrapMcpResult(result);
          logTool("search_modules", { query }, text);
          return text;
        },
      }),
    );
  }

  if (caps?.catalog?.get) {
    tools.push(
      new DynamicStructuredTool({
        name: "get_component",
        description: "Obtiene código fuente y detalles de un componente. Usa el moduleId exacto del resolve/search.",
        schema: z.object({
          moduleId: z.string().describe("moduleId exacto del design system"),
          exportName: z.string().nullable().optional().describe("Nombre del export específico"),
        }),
        func: async ({ moduleId, exportName }) => {
          const result = await componentSource.getComponent(userId, moduleId, exportName ?? undefined);
          const text = unwrapMcpResult(result);
          logTool("get_component", { moduleId, exportName }, text);
          return text;
        },
      }),
    );
  }

  if (caps?.catalog?.props) {
    tools.push(
      new DynamicStructuredTool({
        name: "get_props",
        description: "Obtiene las props de un componente. Usa el moduleId exacto del resolve/search.",
        schema: z.object({
          moduleId: z.string().describe("moduleId exacto del design system"),
          exportName: z.string().nullable().optional().describe("Nombre del export específico"),
        }),
        func: async ({ moduleId, exportName }) => {
          const result = await componentSource.getProps(userId, moduleId, exportName ?? undefined);
          const text = unwrapMcpResult(result);
          logTool("get_props", { moduleId, exportName }, text);
          return text;
        },
      }),
    );
  }

  if (caps?.catalog?.recipe) {
    tools.push(
      new DynamicStructuredTool({
        name: "get_composition_recipe",
        description: "Obtiene recetas de composición para componentes complejos. Usa el moduleId exacto.",
        schema: z.object({
          moduleId: z.string().describe("moduleId exacto del design system"),
        }),
        func: async ({ moduleId }) => {
          const result = await componentSource.getCompositionRecipe(userId, moduleId);
          const text = unwrapMcpResult(result);
          logTool("get_composition_recipe", { moduleId }, text);
          return text;
        },
      }),
    );
  }

  return tools;
}

/**
 * Fetches the full module catalog via catalog.list (required role).
 * Throws when catalog.list is unavailable or returns no module ids.
 */
async function fetchModuleCatalog(
  componentSource: ComponentSourcePort,
  userId: string,
): Promise<string> {
  if (!componentSource.capabilities?.catalog?.list) {
    throw new Error(
      "El perfil no tiene mapeada la herramienta obligatoria catalog.list. Confirma el mapeo MCP del perfil.",
    );
  }

  const result = await componentSource.listModules(userId);
  const text = unwrapMcpToolText(result);
  if (text.startsWith("[MCP_ERROR]")) {
    throw new Error(
      `No se pudo obtener el catálogo de componentes (${text.replace(/^\[MCP_ERROR\]\s*/, "").slice(0, 200)}).`,
    );
  }

  const validation = validateCatalogListText(text);
  const sampleIds = [...extractCatalogModuleIds(text)].slice(0, 25);
  if (validation.ok) {
    console.log(
      `\x1b[32m[Wireframes/MCP] list_modules OK (${text.length} chars, sampleIds=${sampleIds.length}: ${sampleIds.slice(0, 12).join(", ")}${sampleIds.length > 12 ? "…" : ""})\x1b[0m`,
    );
  } else {
    console.log(
      `\x1b[33m[Wireframes/MCP] list_modules: catálogo inválido. preview=${validation.preview}\x1b[0m`,
    );
    throw new Error(
      validation.reason ??
        "El catálogo MCP no devolvió módulos reconocibles. Revisa el mapeo catalog.list del perfil.",
    );
  }
  return text;
}

/**
 * Pre-resolves required component names via catalog.resolve or catalog.list fuzzy match.
 */
async function batchResolveComponents(
  componentSource: ComponentSourcePort,
  userId: string,
  screens: WireframesStateType["screens"],
  moduleCatalog: string,
): Promise<string> {
  const allNames = new Set<string>();
  for (const s of screens) {
    for (const c of s.requiredComponents) allNames.add(c);
  }
  const uniqueNames = [...allNames];
  if (uniqueNames.length === 0) return "No hay componentes para resolver.";

  console.log(`\x1b[36m[Wireframes/MCP] Batch resolving ${uniqueNames.length} component names…\x1b[0m`);

  const expandedQueries = [...new Set(
    uniqueNames.flatMap((name) => expandWireframeResolveQueries(name)),
  )];

  if (componentSource.capabilities?.catalog?.resolve) {
    try {
      const result = await componentSource.resolveComponents(userId, expandedQueries);
      const text = unwrapMcpToolText(result);
      console.log(`\x1b[32m[Wireframes/MCP] Batch resolve OK (${text.length} chars)\x1b[0m`);
      const resolvedByQuery = new Map(
        parseResolveComponentsText(text)
          .filter((r) => r.query?.trim())
          .map((r) => [r.query!.trim().toLowerCase(), r]),
      );
      const results = uniqueNames.map((query) => {
        for (const candidate of expandWireframeResolveQueries(query)) {
          const hit = resolvedByQuery.get(candidate.toLowerCase());
          const moduleId = hit ? resolutionToModuleId(hit) : null;
          if (moduleId) {
            return {
              query,
              moduleId,
              exportName: hit!.exportName,
              status: hit!.status ?? ("exact_module" as const),
            };
          }
        }
        return { query, status: "not_found" as const };
      });
      return JSON.stringify({ results });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`\x1b[31m[Wireframes/MCP] Batch resolve failed: ${errMsg}\x1b[0m`);
    }
  }

  const results = uniqueNames.map((query) => {
    const hit = fuzzyMatchModuleWithAliases(query, moduleCatalog);
    if (!hit) {
      return { query, status: "not_found" as const };
    }
    return {
      query,
      moduleId: hit.moduleId,
      exportName: hit.exportName,
      status: hit.status ?? "exact_module",
    };
  });

  const resolvedCount = results.filter((r) => r.status !== "not_found").length;
  console.log(
    `\x1b[32m[Wireframes/MCP] Catalog list resolve OK (${resolvedCount}/${uniqueNames.length} matches)\x1b[0m`,
  );
  return JSON.stringify({ results });
}

/** Creates the Component Mapper node with MCP tools bound to the LLM. */
export function createComponentMapperNode(
  llm: BaseChatModel,
  mcpTools: StructuredToolInterface[],
  componentSource: ComponentSourcePort,
  userId: string,
  dsRefresh = false,
) {
  const toolsByName = buildToolsByName(mcpTools);
  const llmWithTools = llm.bindTools ? (mcpTools.length > 0 ? llm.bindTools(mcpTools) : llm) : llm;

  return async (state: WireframesStateType): Promise<Partial<WireframesStateType>> => {
    const iteration = state.iterationCount ?? 0;
    const isRevision = iteration > 0;
    const stepNum = dsRefresh ? 1 : isRevision ? 4 + iteration : 2;
    const totalSteps = dsRefresh ? 2 : isRevision ? 4 + iteration * 2 : 4;
    const label = dsRefresh
      ? "Re-mapeando componentes (DS)"
      : isRevision
        ? "Re-mapeando componentes"
        : "Mapeando componentes del design system vía MCP";
    const t0 = performance.now();
    console.log(`\x1b[36m[Wireframes] ▶ Step ${stepNum}/${totalSteps}: ${label} (userId=${userId.slice(0, 8)}…, screens=${state.screens.length})\x1b[0m`);

    let moduleCatalog = "";
    let resolveResult = "No hay componentes para resolver.";
    try {
      moduleCatalog = await fetchModuleCatalog(componentSource, userId);
      resolveResult = await batchResolveComponents(
        componentSource,
        userId,
        state.screens,
        moduleCatalog,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`\x1b[31m[Wireframes/MCP] catalog step failed: ${errMsg}\x1b[0m`);
      throw err;
    }

    console.log(
      `\x1b[36m[Wireframes/MCP] context: catalogLen=${moduleCatalog.length} resolveLen=${resolveResult.length} resolvePreview=${resolveResult.slice(0, 280).replace(/\n/g, " ")}\x1b[0m`,
    );

    const screensContext = state.screens
      .map(
        (s) =>
          `- **${s.name}** (${s.id}): componentes requeridos: ${s.requiredComponents.join(", ")}`,
      )
      .join("\n");

    let prompt = `${COMPONENT_MAPPER_PROMPT}\n\n---\n## Pantallas y componentes requeridos\n${screensContext}`;

    prompt += formatDesignSystemContextBlock(state.designSystemContext);

    if (moduleCatalog) {
      prompt += `\n\n## Catálogo completo de módulos del Design System\nEstos son TODOS los módulos disponibles en el design system. Solo puedes usar moduleId de esta lista:\n\n${moduleCatalog}`;
    }

    prompt += `\n\n## Resolución de componentes del Design System (pre-calculada)\nA continuación los resultados de resolución de nombres → moduleId para todos los componentes requeridos. Usa estos moduleId para tus llamadas a herramientas de catálogo disponibles (\`get_component\`, \`get_props\`, \`get_composition_recipe\`):\n\n${resolveResult}`;

    if (state.criticFeedback?.trim()) {
      prompt += `\n\n## Feedback del crítico (corregir)\n${state.criticFeedback}`;
    }

    const messages = [new HumanMessage(prompt)];
    let lastContent = "";
    let loopCount = 0;

    while (loopCount < MAX_TOOL_LOOPS) {
      const response = await llmWithTools.invoke(messages);
      const aiMsg = response as AIMessage;
      lastContent = extractAIContent(aiMsg);

      const toolCalls = aiMsg.tool_calls ?? [];
      console.log(`\x1b[35m[Wireframes/MCP] Loop ${loopCount}: contentLength=${lastContent.length}, toolCalls=${toolCalls.length}\x1b[0m`);

      if (toolCalls.length === 0) break;

      const toolMessages: ToolMessage[] = await Promise.all(
        toolCalls.map(async (tc) => {
          const tool = toolsByName[tc.name];
          const toolCallId = tc.id ?? `tc-${loopCount}-${tc.name}`;
          if (!tool) {
            console.log(`\x1b[31m[Wireframes/MCP] Unknown tool called: ${tc.name}\x1b[0m`);
            return new ToolMessage({ content: `Unknown tool: ${tc.name}`, tool_call_id: toolCallId, status: "error" });
          }
          try {
            const result = await tool.invoke(tc);
            return result instanceof ToolMessage
              ? result
              : new ToolMessage({
                  content: typeof result === "string" ? result : JSON.stringify(result),
                  tool_call_id: toolCallId,
                });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`\x1b[31m[Wireframes/MCP] Tool ${tc.name} threw: ${errMsg}\x1b[0m`);
            return new ToolMessage({ content: `Error: ${errMsg}`, tool_call_id: toolCallId, status: "error" });
          }
        }),
      );

      messages.push(aiMsg, ...toolMessages);
      loopCount++;
    }

    if (!lastContent.trim() && loopCount >= MAX_TOOL_LOOPS) {
      console.log(`\x1b[33m[Wireframes/MCP] Loop limit reached. Forcing final response without tools…\x1b[0m`);
      messages.push(new HumanMessage(
        "Has alcanzado el límite de llamadas a herramientas. " +
        "Con la información que ya tienes (resolución de componentes y resultados de herramientas), " +
        "genera ahora el JSON final con el schema { componentMappings: [...] }. " +
        "Para componentes que no encontraste, usa matchConfidence: \"none\" con un fallbackSuggestion.",
      ));
      const finalMsg = (await llm.invoke(messages)) as AIMessage;
      lastContent = extractAIContent(finalMsg);
      console.log(`\x1b[35m[Wireframes/MCP] Final forced response: contentLength=${lastContent.length}\x1b[0m`);
    }

    if (!lastContent.trim()) {
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      console.log(`\x1b[33m[Wireframes] ✓ Step ${stepNum}/${totalSteps}: 0 componentes mapeados — lastContent vacío (${elapsed}s)\x1b[0m`);
      return { componentMappings: [], status: "mapping" };
    }

    let componentMappings: z.infer<typeof componentMapperOutputSchema>["componentMappings"] = [];
    try {
      const parsed = parseComponentMapperOutput(lastContent);
      componentMappings = parsed.componentMappings;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`\x1b[31m[Wireframes/MCP] Parse error: ${errMsg}\x1b[0m`);
      console.log(`\x1b[31m[Wireframes/MCP] lastContent (first 500): ${lastContent.slice(0, 500)}\x1b[0m`);
      componentMappings = [];
    }

    if (componentMappings.length === 0) {
      const resolved = parseResolveComponentsText(resolveResult);
      const fallback: z.infer<typeof componentMapperOutputSchema>["componentMappings"] = [];
      for (const screen of state.screens) {
        for (const comp of screen.requiredComponents) {
          const hit = resolved.find((r) => r.query?.trim() === comp.trim());
          const moduleId = hit ? resolutionToModuleId(hit) : null;
          fallback.push({
            screenId: screen.id,
            requiredComponent: comp,
            mcpModuleId: moduleId,
            mcpExportName: hit?.exportName ?? null,
            mcpProps: null,
            compositionRecipe: null,
            matchConfidence: moduleId ? "exact" : "none",
            fallbackSuggestion: moduleId ? null : `Sin match MCP para ${comp}`,
          });
        }
      }
      if (fallback.length > 0) {
        console.log(`\x1b[33m[Wireframes/MCP] Parse vacío: usando ${fallback.length} mappings desde resolve_components\x1b[0m`);
        componentMappings = fallback;
      }
    }

    componentMappings = await reconcileComponentMappings(
      componentSource,
      userId,
      componentMappings,
      moduleCatalog,
    );

    const catalogIds = extractCatalogModuleIds(moduleCatalog);
    const inCatalog = componentMappings.filter((m) => m.mcpModuleId && catalogIds.has(m.mcpModuleId)).length;
    console.log(
      `\x1b[36m[Wireframes/MCP] post-reconcile: inCatalog=${inCatalog}/${componentMappings.length} catalogSize=${catalogIds.size}\x1b[0m`,
    );

    const uniqueMcpIds = [...new Set(componentMappings.map((m) => m.mcpModuleId).filter(Boolean))];
    const byConfidence = {
      exact: componentMappings.filter((m) => m.matchConfidence === "exact").length,
      partial: componentMappings.filter((m) => m.matchConfidence === "partial").length,
      none: componentMappings.filter((m) => m.matchConfidence === "none").length,
    };
    console.log(
      `\x1b[36m[Wireframes/MCP] mappings: total=${componentMappings.length} uniqueMcpModuleIds=${uniqueMcpIds.length} confidence=${JSON.stringify(byConfidence)}\x1b[0m`,
    );
    console.log(`\x1b[36m[Wireframes/MCP] unique mcpModuleIds: ${uniqueMcpIds.slice(0, 20).join(", ")}${uniqueMcpIds.length > 20 ? "…" : ""}\x1b[0m`);
    if (componentMappings.length > 0 && componentMappings.length <= 8) {
      for (const m of componentMappings) {
        console.log(
          `\x1b[36m[Wireframes/MCP]   ${m.screenId}/${m.requiredComponent} → mcpModuleId="${m.mcpModuleId}" confidence=${m.matchConfidence}\x1b[0m`,
        );
      }
    }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`\x1b[32m[Wireframes] ✓ Step ${stepNum}/${totalSteps}: ${componentMappings.length} componentes mapeados (${elapsed}s)\x1b[0m`);

    return {
      componentMappings,
      status: "mapping",
    };
  };
}
