import type { ProjectDeliverableSource } from "@theforge/shared-types";

/** Campos de entregables que viven por etapa (Stage) y se sincronizan con Project. */
export const WORKSHOP_STAGE_DELIVERABLE_FIELDS = [
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
] as const;

export type WorkshopStageDeliverableField = (typeof WORKSHOP_STAGE_DELIVERABLE_FIELDS)[number];

export function isStageScopedDeliverableField(field: string): field is WorkshopStageDeliverableField {
  return (WORKSHOP_STAGE_DELIVERABLE_FIELDS as readonly string[]).includes(field);
}

export type WorkshopStageDeliverableSource = ProjectDeliverableSource & {
  stages?: Array<ProjectDeliverableSource & { id: string }>;
};

function hasNonEmptyDeliverable(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Resuelve entregables visibles para la etapa en foco (columnas Stage → fallback Project). */
export function resolveWorkshopStageDeliverables(
  project: WorkshopStageDeliverableSource,
  stageId: string | null,
): ProjectDeliverableSource {
  const stage =
    stageId && project.stages?.length
      ? (project.stages.find((s) => s.id === stageId) ?? null)
      : null;
  const deliverables: ProjectDeliverableSource = {};
  for (const key of WORKSHOP_STAGE_DELIVERABLE_FIELDS) {
    const fromStage = stage?.[key];
    deliverables[key] = hasNonEmptyDeliverable(fromStage) ? fromStage : (project[key] ?? null);
  }
  return deliverables;
}

export function workshopDeliverableStoreSlice(
  deliverables: ProjectDeliverableSource,
): Record<WorkshopStageDeliverableField, string | null> {
  const slice = {} as Record<WorkshopStageDeliverableField, string | null>;
  for (const key of WORKSHOP_STAGE_DELIVERABLE_FIELDS) {
    const raw = deliverables[key];
    slice[key] = typeof raw === "string" ? raw : raw ?? null;
  }
  return slice;
}
