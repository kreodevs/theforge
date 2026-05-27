import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { WIREFRAME_COMPOSER_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";
import type { WireframesStateType } from "../state/index.js";
import { injectWireframeComponentTables } from "../utils/wireframes-mcp-resolve.util.js";
import { formatDesignSystemContextBlock } from "../utils/wireframe-design-system-context.util.js";

/** Creates the Wireframe Composer node: generates the full Markdown wireframe document. */
export function createWireframeComposerNode(llm: BaseChatModel) {
  return async (state: WireframesStateType): Promise<Partial<WireframesStateType>> => {
    const iteration = state.iterationCount ?? 0;
    const isRevision = iteration > 0;
    const stepNum = isRevision ? 4 + iteration * 2 - 1 : 3;
    const totalSteps = isRevision ? 4 + iteration * 2 : 4;
    const label = isRevision ? "Re-componiendo wireframes" : "Componiendo wireframes visuales";
    const t0 = performance.now();
    console.log(`\x1b[36m[Wireframes] ▶ Step ${stepNum}/${totalSteps}: ${label}...\x1b[0m`);

    const screensJson = JSON.stringify(state.screens, null, 2);
    const mappingsJson = JSON.stringify(state.componentMappings, null, 2);
    const mappingModuleIds = [
      ...new Set((state.componentMappings ?? []).map((m) => m.mcpModuleId).filter(Boolean)),
    ];
    console.log(
      `\x1b[36m[Wireframes] composer input: screens=${state.screens.length} mappings=${state.componentMappings?.length ?? 0} uniqueMcpIds=${mappingModuleIds.length} ids=${mappingModuleIds.slice(0, 15).join(", ")}\x1b[0m`,
    );

    const contextParts = [
      "## Pantallas identificadas",
      screensJson,
      "",
      "## Mapeo de componentes del Design System",
      mappingsJson,
      formatDesignSystemContextBlock(state.designSystemContext),
    ];

    if (state.criticFeedback?.trim()) {
      contextParts.push(
        "",
        "## Feedback del crítico (incorporar correcciones)",
        state.criticFeedback,
      );
    }

    const prompt = `${WIREFRAME_COMPOSER_PROMPT}\n\n---\n${contextParts.join("\n")}`;
    const response = await llm.invoke([new HumanMessage(prompt)]);
    let wireframeDocument =
      typeof response.content === "string"
        ? response.content.trim()
        : "";

    if (wireframeDocument && (state.componentMappings?.length ?? 0) > 0) {
      const before = wireframeDocument.length;
      wireframeDocument = injectWireframeComponentTables(wireframeDocument, state.componentMappings);
      console.log(
        `\x1b[36m[Wireframes] composer: tablas DS inyectadas desde mappings (${before} → ${wireframeDocument.length} chars)\x1b[0m`,
      );
    }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`\x1b[32m[Wireframes] ✓ Step ${stepNum}/${totalSteps}: Documento generado (${elapsed}s)\x1b[0m`);

    return {
      wireframeDocument:
        wireframeDocument || "# Wireframes\n\n(Sin contenido generado.)",
      status: "composing",
    };
  };
}
