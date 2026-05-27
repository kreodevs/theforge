import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { SCREEN_ANALYZER_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";
import { screenDefinitionSchema, type WireframesStateType } from "../state/index.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";

const screenAnalyzerOutputSchema = z.object({
  screens: z.array(screenDefinitionSchema),
});

/** Creates the Screen Analyzer node: extracts screens from use cases + user stories. */
export function createScreenAnalyzerNode(llm: BaseChatModel) {
  return async (state: WireframesStateType): Promise<Partial<WireframesStateType>> => {
    const t0 = performance.now();
    console.log("\x1b[36m[Wireframes] ▶ Step 1/4: Analizando pantallas desde casos de uso e historias de usuario...\x1b[0m");

    const context = [
      "## Casos de Uso",
      state.useCases || "(vacío)",
      "",
      "## Historias de Usuario",
      state.userStories || "(vacío)",
    ].join("\n");

    const prompt = `${SCREEN_ANALYZER_PROMPT}\n\n---\n${context}`;
    const response = await llm.invoke([new HumanMessage(prompt)]);
    const text = typeof response.content === "string" ? response.content : "";

    let screens: z.infer<typeof screenAnalyzerOutputSchema>["screens"] = [];
    try {
      const parsed = parseJsonOrThrow(text, screenAnalyzerOutputSchema);
      screens = parsed.screens;
    } catch {
      screens = [];
    }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`\x1b[32m[Wireframes] ✓ Step 1/4: ${screens.length} pantallas identificadas (${elapsed}s)\x1b[0m`);

    return {
      screens,
      status: "analyzing",
    };
  };
}
