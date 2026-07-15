import { z } from "zod";

export const traceabilityGapKindSchema = z.enum([
  "capability",
  "rule",
  "entity",
  "formula",
  "uat",
  "permission",
  "flow",
]);

export const traceabilityGapSeveritySchema = z.enum(["missing", "partial", "contradiction"]);

export const traceabilityGapInputSchema = z.object({
  concept: z.string().min(1),
  hint: z.string().optional(),
  brdSection: z.string().optional(),
  brdSubsection: z.string().optional(),
  kind: traceabilityGapKindSchema.optional(),
  missingTerms: z.array(z.string()).optional(),
  severity: traceabilityGapSeveritySchema.optional(),
});

export const mddTraceTargetSectionSchema = z.enum(["s1", "s4", "s5"]);

export const traceabilitySuggestFixRequestSchema = z.object({
  projectId: z.string().uuid(),
  stageId: z.string().uuid().optional(),
  gap: traceabilityGapInputSchema,
  /** Borrador MDD visible en el Workshop; si falta, el API usa el persistido. */
  mddContent: z.string().optional(),
});

export const traceabilitySuggestFixResponseSchema = z.object({
  suggestion: z.string().min(1),
  targetSection: mddTraceTargetSectionSchema,
  insertMode: z.literal("append"),
  rationale: z.string().optional(),
});

export type TraceabilityGapInput = z.infer<typeof traceabilityGapInputSchema>;
export type MddTraceTargetSection = z.infer<typeof mddTraceTargetSectionSchema>;
export type TraceabilitySuggestFixRequest = z.infer<typeof traceabilitySuggestFixRequestSchema>;
export type TraceabilitySuggestFixResponse = z.infer<typeof traceabilitySuggestFixResponseSchema>;
