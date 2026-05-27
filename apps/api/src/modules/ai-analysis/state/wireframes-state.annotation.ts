import { Annotation } from "@langchain/langgraph";
import type {
  ComponentMapping,
  ScreenDefinition,
  WireframesCriticDecision,
  WireframesStatus,
} from "./wireframes-state.schema.js";

/**
 * LangGraph State annotation for the Wireframes workflow.
 * Strictly typed; matches WireframesState from wireframes-state.schema.
 */
export const WireframesStateAnnotation = Annotation.Root({
  useCases: Annotation<string>(),
  userStories: Annotation<string>(),
  designSystemContext: Annotation<string | undefined>(),
  screens: Annotation<ScreenDefinition[]>({
    reducer: (_left, right) => (Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
  componentMappings: Annotation<ComponentMapping[]>({
    reducer: (_left, right) => (Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
  wireframeDocument: Annotation<string>(),
  criticDecision: Annotation<WireframesCriticDecision | undefined>(),
  criticFeedback: Annotation<string | undefined>(),
  iterationCount: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  status: Annotation<WireframesStatus>(),
});

/** Inferred state type for nodes: (state: WireframesStateType) => Partial<WireframesStateType> */
export type WireframesStateType = typeof WireframesStateAnnotation.State;

/** Update type returned by nodes */
export type WireframesStateUpdate = typeof WireframesStateAnnotation.Update;
