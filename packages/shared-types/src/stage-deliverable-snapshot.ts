import { z } from "zod";

export const stageDeliverableFieldsSchema = z.object({
  specContent: z.string().nullable().optional(),
  architectureContent: z.string().nullable().optional(),
  useCasesContent: z.string().nullable().optional(),
  userStoriesContent: z.string().nullable().optional(),
  blueprintContent: z.string().nullable().optional(),
  tasksContent: z.string().nullable().optional(),
  apiContractsContent: z.string().nullable().optional(),
  logicFlowsContent: z.string().nullable().optional(),
  infraContent: z.string().nullable().optional(),
  agentGovernanceContent: z.string().nullable().optional(),
  uxUiGuideContent: z.string().nullable().optional(),
  uiScreensContent: z.string().nullable().optional(),
  phase0SummaryContent: z.string().nullable().optional(),
  aemContent: z.string().nullable().optional(),

});

export const stageDeliverableSnapshotSchema = stageDeliverableFieldsSchema.extend({
  capturedAt: z.string(),
  source: z.enum(["project_flat", "manual", "cascade"]).optional(),
  /** Cross-artifact bundle version (US + pantallas + API + tasks regenerated together). */
  bundleVersion: z.string().optional(),
  bundleGeneratedAt: z.string().optional(),
});

export type StageDeliverableSnapshot = z.infer<typeof stageDeliverableSnapshotSchema>;
export type ProjectDeliverableSource = z.infer<typeof stageDeliverableFieldsSchema>;

const DELIVERABLE_KEYS = [
  "specContent",
  "architectureContent",
  "useCasesContent",
  "userStoriesContent",
  "blueprintContent",
  "tasksContent",
  "apiContractsContent",
  "logicFlowsContent",
  "infraContent",
  "agentGovernanceContent",
  "uxUiGuideContent",
  "uiScreensContent",
  "phase0SummaryContent",
  "aemContent",

] as const satisfies readonly (keyof ProjectDeliverableSource)[];

export function readStageDeliverableSnapshot(raw: unknown): StageDeliverableSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const parsed = stageDeliverableSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function buildStageDeliverableSnapshotFromProject(
  project: ProjectDeliverableSource,
  options?: { capturedAt?: string; source?: StageDeliverableSnapshot["source"] },
): StageDeliverableSnapshot {
  const capturedAt = options?.capturedAt ?? new Date().toISOString();
  const fields: ProjectDeliverableSource = {};
  for (const key of DELIVERABLE_KEYS) {
    const value = project[key];
    if (value !== undefined) fields[key] = value ?? null;
  }
  return { ...fields, capturedAt, source: options?.source ?? "project_flat" };
}

export function resolveStageDeliverableField(
  field: keyof ProjectDeliverableSource,
  stageSnapshot: StageDeliverableSnapshot | null,
  project: ProjectDeliverableSource,
): string | null | undefined {
  const fromSnapshot = stageSnapshot?.[field];
  if (typeof fromSnapshot === "string" && fromSnapshot.trim()) return fromSnapshot;
  return project[field] ?? null;
}

export type StageDeliverableRow = ProjectDeliverableSource;

function hasNonEmptyDeliverable(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolves live deliverables for an active stage: Stage columns first, Project flat fallback.
 */
export function resolveLiveStageDeliverables(
  stage: StageDeliverableRow | null | undefined,
  project: ProjectDeliverableSource,
): ProjectDeliverableSource {
  const deliverables: ProjectDeliverableSource = {};
  for (const key of DELIVERABLE_KEYS) {
    const fromStage = stage?.[key];
    deliverables[key] = hasNonEmptyDeliverable(fromStage) ? fromStage : (project[key] ?? null);
  }
  return deliverables;
}

export function pickDeliverableFieldsFromSource(
  source: ProjectDeliverableSource,
): ProjectDeliverableSource {
  const picked: ProjectDeliverableSource = {};
  for (const key of DELIVERABLE_KEYS) {
    if (source[key] !== undefined) picked[key] = source[key] ?? null;
  }
  return picked;
}

export type StageDeliverablesSource = "snapshot" | "live";

export interface StageDeliverablesResponse {
  stageId: string;
  ordinal: number;
  workflowStatus: string;
  source: StageDeliverablesSource;
  snapshotCapturedAt?: string;
  readOnly: boolean;
  deliverables: ProjectDeliverableSource;
  /** Delta change spec for stage 2+ (when present). */
  changeSpecContent?: string | null;
}
