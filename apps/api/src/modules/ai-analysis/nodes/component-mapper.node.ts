import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { COMPONENT_MAPPER_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";
import { componentMappingSchema, type WireframesStateType } from "../state/index.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";
import {
  extractCatalogModuleIds,
  parseResolveComponentsText,
  reconcileComponentMappings,
  resolutionToModuleId,
  unwrapMcpToolText,
} from "../utils/wireframes-mcp-resolve.util.js";
import { formatDesignSystemContextBlock } from "../utils/wireframe-design-system-context.util.js";
import type { ComponentMcpService } from "../../component-mcp/component-mcp.service.js";
import type { McpToolResult } from "../../component-mcp/component-mcp-client-contract.js";

const componentMapperOutputSchema = z.object({
  componentMappings: z.array(componentMappingSchema),
});

const MAX_TOOL_LOOPS = 10;

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

/** Creates DynamicStructuredTool wrappers around the ComponentMcpService methods. */
export function createComponentMcpTools(
  componentMcpService: ComponentMcpService,
  userId: string,
): DynamicStructuredTool[] {
  const logTool = (name: string, args: Record<string, unknown>, text: string) => {
    console.log(`\x1b[35m[Wireframes/MCP] ${name}(${JSON.stringify(args)}) → ${text.slice(0, 300)}\x1b[0m`);
  };

  return [
    new DynamicStructuredTool({
      name: "search_modules",
      description: "Busca módulos en el design system por query. Devuelve JSON con array 'hits'.",
      schema: z.object({ query: z.string().describe("Término de búsqueda") }),
      func: async ({ query }) => {
        const result = await componentMcpService.searchModules(userId, query);
        const text = unwrapMcpResult(result);
        logTool("search_modules", { query }, text);
        return text;
      },
    }),
    new DynamicStructuredTool({
      name: "get_component",
      description: "Obtiene código fuente y detalles de un componente. Usa el moduleId exacto del resolve/search.",
      schema: z.object({
        moduleId: z.string().describe("moduleId exacto del design system"),
        exportName: z.string().nullable().optional().describe("Nombre del export específico"),
      }),
      func: async ({ moduleId, exportName }) => {
        const result = await componentMcpService.getComponent(userId, moduleId, exportName ?? undefined);
        const text = unwrapMcpResult(result);
        logTool("get_component", { moduleId, exportName }, text);
        return text;
      },
    }),
    new DynamicStructuredTool({
      name: "get_props",
      description: "Obtiene las props de un componente. Usa el moduleId exacto del resolve/search.",
      schema: z.object({
        moduleId: z.string().describe("moduleId exacto del design system"),
        exportName: z.string().nullable().optional().describe("Nombre del export específico"),
      }),
      func: async ({ moduleId, exportName }) => {
        const result = await componentMcpService.getProps(userId, moduleId, exportName ?? undefined);
        const text = unwrapMcpResult(result);
        logTool("get_props", { moduleId, exportName }, text);
        return text;
      },
    }),
    new DynamicStructuredTool({
      name: "get_composition_recipe",
      description: "Obtiene recetas de composición para componentes complejos. Usa el moduleId exacto.",
      schema: z.object({
        moduleId: z.string().describe("moduleId exacto del design system"),
      }),
      func: async ({ moduleId }) => {
        const result = await componentMcpService.getCompositionRecipe(userId, moduleId);
        const text = unwrapMcpResult(result);
        logTool("get_composition_recipe", { moduleId }, text);
        return text;
      },
    }),
  ];
}

/**
 * Fetches the full module catalog via list_modules so the LLM knows what actually exists.
 */
async function fetchModuleCatalog(
  componentMcpService: ComponentMcpService,
  userId: string,
): Promise<string> {
  try {
    const result = await componentMcpService.listModules(userId);
    const text = unwrapMcpToolText(result);
    const sampleIds = [...extractCatalogModuleIds(text)].slice(0, 25);
    console.log(
      `\x1b[32m[Wireframes/MCP] list_modules OK (${text.length} chars, sampleIds=${sampleIds.length}: ${sampleIds.slice(0, 12).join(", ")}${sampleIds.length > 12 ? "…" : ""})\x1b[0m`,
    );
    if (sampleIds.length === 0) {
      console.log(`\x1b[33m[Wireframes/MCP] list_modules: no se pudieron extraer ids del catálogo. preview=${text.slice(0, 200)}\x1b[0m`);
    }
    return text;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`\x1b[31m[Wireframes/MCP] list_modules failed: ${errMsg}\x1b[0m`);
    return "";
  }
}

/**
 * Pre-resolves all required component names via batch MCP resolve_components.
 * Returns a formatted string with resolution results ready for the LLM context.
 */
async function batchResolveComponents(
  componentMcpService: ComponentMcpService,
  userId: string,
  screens: WireframesStateType["screens"],
): Promise<string> {
  const allNames = new Set<string>();
  for (const s of screens) {
    for (const c of s.requiredComponents) allNames.add(c);
  }
  const uniqueNames = [...allNames];
  if (uniqueNames.length === 0) return "No hay componentes para resolver.";

  console.log(`\x1b[36m[Wireframes/MCP] Batch resolving ${uniqueNames.length} component names…\x1b[0m`);

  try {
    const result = await componentMcpService.resolveComponents(userId, uniqueNames);
    const text = unwrapMcpToolText(result);
    console.log(`\x1b[32m[Wireframes/MCP] Batch resolve OK (${text.length} chars)\x1b[0m`);
    return text;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`\x1b[31m[Wireframes/MCP] Batch resolve failed: ${errMsg}\x1b[0m`);
    return `[MCP_ERROR] resolve_components falló: ${errMsg}. Usa search_modules como fallback.`;
  }
}

/** Creates the Component Mapper node with MCP tools bound to the LLM. */
export function createComponentMapperNode(
  llm: BaseChatModel,
  mcpTools: StructuredToolInterface[],
  componentMcpService: ComponentMcpService,
  userId: string,
) {
  const toolsByName = buildToolsByName(mcpTools);
  const llmWithTools = llm.bindTools ? (mcpTools.length > 0 ? llm.bindTools(mcpTools) : llm) : llm;

  return async (state: WireframesStateType): Promise<Partial<WireframesStateType>> => {
    const iteration = state.iterationCount ?? 0;
    const isRevision = iteration > 0;
    const stepNum = isRevision ? 4 + iteration : 2;
    const totalSteps = isRevision ? 4 + iteration * 2 : 4;
    const label = isRevision ? "Re-mapeando componentes" : "Mapeando componentes del design system vía MCP";
    const t0 = performance.now();
    console.log(`\x1b[36m[Wireframes] ▶ Step ${stepNum}/${totalSteps}: ${label} (userId=${userId.slice(0, 8)}…, screens=${state.screens.length})\x1b[0m`);

    const [resolveResult, moduleCatalog] = await Promise.all([
      batchResolveComponents(componentMcpService, userId, state.screens),
      fetchModuleCatalog(componentMcpService, userId),
    ]);

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

    prompt += `\n\n## Resolución de componentes del Design System (pre-calculada)\nA continuación los resultados de \`resolve_components\` para todos los componentes requeridos. Usa estos moduleId para tus llamadas a \`get_component\`, \`get_props\` y \`get_composition_recipe\`:\n\n${resolveResult}`;

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

      const toolMessages: ToolMessage[] = [];
      for (const tc of toolCalls) {
        const tool = toolsByName[tc.name];
        const toolCallId = tc.id ?? `tc-${loopCount}-${tc.name}`;
        if (!tool) {
          console.log(`\x1b[31m[Wireframes/MCP] Unknown tool called: ${tc.name}\x1b[0m`);
          toolMessages.push(new ToolMessage({ content: `Unknown tool: ${tc.name}`, tool_call_id: toolCallId, status: "error" }));
          continue;
        }
        try {
          const result = await tool.invoke(tc);
          const msg = result instanceof ToolMessage
            ? result
            : new ToolMessage({ content: typeof result === "string" ? result : JSON.stringify(result), tool_call_id: toolCallId });
          toolMessages.push(msg);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`\x1b[31m[Wireframes/MCP] Tool ${tc.name} threw: ${errMsg}\x1b[0m`);
          toolMessages.push(new ToolMessage({ content: `Error: ${errMsg}`, tool_call_id: toolCallId, status: "error" }));
        }
      }

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
      const parsed = parseJsonOrThrow(lastContent, componentMapperOutputSchema);
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
      componentMcpService,
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
