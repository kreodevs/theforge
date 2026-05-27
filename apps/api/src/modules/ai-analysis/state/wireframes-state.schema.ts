import { z } from "zod";

/**
 * Screen identified from use cases / user stories.
 * Each screen maps to at least one use case or user story.
 */
export const screenDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  sourceUseCases: z.array(z.string()),
  sourceUserStories: z.array(z.string()),
  requiredComponents: z.array(z.string()),
  navigationFlow: z.array(z.string()),
});

export type ScreenDefinition = z.infer<typeof screenDefinitionSchema>;

/**
 * Component mapping from the design system MCP.
 * Links a required UI component on a screen to a real module/export.
 */
export const componentMappingSchema = z.object({
  screenId: z.string(),
  requiredComponent: z.string(),
  mcpModuleId: z.string().nullish(),
  mcpExportName: z.string().nullish(),
  mcpProps: z.record(z.unknown()).nullish(),
  compositionRecipe: z.string().nullish(),
  matchConfidence: z.enum(["exact", "partial", "none"]),
  fallbackSuggestion: z.string().nullish(),
});

export type ComponentMapping = z.infer<typeof componentMappingSchema>;

/** Critic decision for wireframes review */
export const wireframesCriticDecisionSchema = z.enum(["approved", "needs_revision"]);
export type WireframesCriticDecision = z.infer<typeof wireframesCriticDecisionSchema>;

/** Workflow status for Wireframes pipeline */
export const wireframesStatusSchema = z.enum([
  "idle",
  "analyzing",
  "mapping",
  "composing",
  "reviewing",
  "done",
]);
export type WireframesStatus = z.infer<typeof wireframesStatusSchema>;

/**
 * Shared state between wireframes agents (LangGraph State).
 * Strictly typed; use Zod schemas for validation at boundaries.
 */
export const wireframesStateSchema = z.object({
  /** Use cases document (input) */
  useCases: z.string(),
  /** User stories document (input) */
  userStories: z.string(),
  /** Design system context from MCP (optional pre-loaded catalog) */
  designSystemContext: z.string().optional(),
  /** Screens identified by the Screen Analyzer */
  screens: z.array(screenDefinitionSchema),
  /** Component mappings from the Component Mapper */
  componentMappings: z.array(componentMappingSchema),
  /** Final wireframe Markdown document */
  wireframeDocument: z.string(),
  /** Critic verdict */
  criticDecision: wireframesCriticDecisionSchema.optional(),
  /** Critic feedback for revision */
  criticFeedback: z.string().optional(),
  /** Number of critic iterations completed */
  iterationCount: z.number().int().min(0),
  /** Current pipeline status */
  status: wireframesStatusSchema,
});

export type WireframesState = z.infer<typeof wireframesStateSchema>;

/** Default state for initializing the wireframes graph */
export const defaultWireframesState: WireframesState = {
  useCases: "",
  userStories: "",
  designSystemContext: undefined,
  screens: [],
  componentMappings: [],
  wireframeDocument: "",
  criticDecision: undefined,
  criticFeedback: undefined,
  iterationCount: 0,
  status: "idle",
};
