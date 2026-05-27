import type { WireframesStateType } from "../state/index.js";

/** Máximo de bucles component_mapper→composer→critic antes de forzar fin. */
export const MAX_WIREFRAMES_CRITIC_ITERATIONS = 2;

/** After Wireframes Critic: revise (component_mapper) or finish. */
export function routeWireframesAfterCritic(
  state: Pick<WireframesStateType, "iterationCount" | "criticDecision">,
  maxIterations = MAX_WIREFRAMES_CRITIC_ITERATIONS,
): "component_mapper" | "__end__" {
  const iterations = state.iterationCount ?? 0;
  if (iterations >= maxIterations) return "__end__";
  return state.criticDecision === "needs_revision" ? "component_mapper" : "__end__";
}
