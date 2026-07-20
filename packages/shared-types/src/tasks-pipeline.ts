import { z } from "zod";

export const tasksPlanItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  layer: z.enum(["Backend", "Frontend", "Infra", "QA"]),
  mddRefs: z.array(z.string()).default([]),
  storyRefs: z.array(z.string()).default([]),
  upstreamRefs: z.array(z.string()).default([]),
  dependsOn: z.array(z.string()).default([]),
  targetFilesHint: z.array(z.string()).default([]),
});

export const tasksGenerationPlanSchema = z.object({
  sections: z.array(z.string()).default([]),
  items: z.array(tasksPlanItemSchema).min(1),
});

export type TasksPlanItem = z.infer<typeof tasksPlanItemSchema>;
export type TasksGenerationPlan = z.infer<typeof tasksGenerationPlanSchema>;

export const tasksLlmAuditorOutputSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  missing_coverage: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
  traceability_gaps: z.array(z.string()).default([]),
  dependency_issues: z.array(z.string()).default([]),
  executable_gaps: z.array(z.string()).default([]),
  feedback: z.string().optional().nullable(),
});

export type TasksLlmAuditorOutput = z.infer<typeof tasksLlmAuditorOutputSchema>;

/** Umbral del Auditor LLM de Tasks (más estricto que cascada genérica). */
export const TASKS_LLM_AUDITOR_PASS_THRESHOLD = 92;

/** Máximo de ciclos de reparación tras fallo de gates. */
export const TASKS_PIPELINE_MAX_REPAIRS = 2;

/** Reparaciones extra cuando el documento quedó truncado (max_tokens). */
export const TASKS_PIPELINE_MAX_REPAIRS_TRUNCATED = 5;

export type TasksPipelineQualitySnapshot = {
  deterministicScore: number;
  taskAccuracyScore: number;
  auditScore: number;
  llmAuditorScore: number;
  taskCount: number;
  plannerItemCount: number;
  repairAttempts: number;
  passed: boolean;
  capturedAt: string;
};

export function readTasksQualitySnapshot(
  shortTermContext: unknown,
): TasksPipelineQualitySnapshot | null {
  if (!shortTermContext || typeof shortTermContext !== "object" || Array.isArray(shortTermContext)) {
    return null;
  }
  const raw = (shortTermContext as Record<string, unknown>).tasksQualitySnapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  if (
    typeof s.deterministicScore !== "number" ||
    typeof s.llmAuditorScore !== "number" ||
    typeof s.passed !== "boolean"
  ) {
    return null;
  }
  return raw as TasksPipelineQualitySnapshot;
}

export function mergeTasksQualityIntoShortTermContext(
  prev: Record<string, unknown>,
  snapshot: TasksPipelineQualitySnapshot,
): Record<string, unknown> {
  return { ...prev, tasksQualitySnapshot: snapshot };
}
