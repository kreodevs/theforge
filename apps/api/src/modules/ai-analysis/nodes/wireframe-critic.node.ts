import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { WIREFRAME_CRITIC_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";
import { wireframesCriticDecisionSchema, type WireframesStateType } from "../state/index.js";
import { parseJsonOrThrow } from "../utils/parse-json.js";
import { formatDesignSystemContextBlock } from "../utils/wireframe-design-system-context.util.js";

const wireframeCriticOutputSchema = z.object({
  decision: wireframesCriticDecisionSchema,
  feedback: z.string(),
});

/** Creates the Wireframe Critic node: reviews the wireframe document against requirements. */
export function createWireframeCriticNode(llm: BaseChatModel) {
  return async (state: WireframesStateType): Promise<Partial<WireframesStateType>> => {
    const currentIteration = (state.iterationCount ?? 0) + 1;
    const stepNum = currentIteration === 1 ? 4 : 4 + (currentIteration - 1) * 2;
    const totalSteps = currentIteration === 1 ? 4 : stepNum;
    const t0 = performance.now();
    console.log(`\x1b[36m[Wireframes] ▶ Step ${stepNum}/${totalSteps}: Revisión del crítico (iteración ${currentIteration}/2)...\x1b[0m`);

    const context = [
      "## Casos de Uso (referencia)",
      state.useCases || "(vacío)",
      "",
      "## Historias de Usuario (referencia)",
      state.userStories || "(vacío)",
      "",
      "## Pantallas identificadas",
      JSON.stringify(state.screens, null, 2),
      "",
      "## Documento de Wireframes a revisar",
      state.wireframeDocument || "(vacío)",
      formatDesignSystemContextBlock(state.designSystemContext),
      "",
      `## Iteración actual: ${currentIteration} de 2`,
    ].join("\n");

    const prompt = `${WIREFRAME_CRITIC_PROMPT}\n\n---\n${context}`;
    const response = await llm.invoke([new HumanMessage(prompt)]);
    const text = typeof response.content === "string" ? response.content : "";

    let criticDecision: "approved" | "needs_revision" = "approved";
    let criticFeedback = "";

    try {
      const parsed = parseJsonOrThrow(text, wireframeCriticOutputSchema);
      criticDecision = parsed.decision;
      criticFeedback = parsed.feedback;
    } catch {
      criticDecision = "approved";
      criticFeedback = "No se pudo parsear la respuesta del crítico; se aprueba por defecto.";
    }

    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    if (criticDecision === "approved") {
      console.log(`\x1b[32m[Wireframes] ✓ Step ${stepNum}/${totalSteps}: Aprobado ✓ (${elapsed}s)\x1b[0m`);
    } else {
      console.log(`\x1b[33m[Wireframes] ⟲ Critic solicitó revisión (iteración ${currentIteration}/2). Volviendo a Component Mapper... (${elapsed}s)\x1b[0m`);
    }

    return {
      criticDecision,
      criticFeedback,
      iterationCount: currentIteration,
      status: "reviewing",
    };
  };
}
