import {
  isStageScopedDeliverableField,
  resolveWorkshopStageDeliverables,
  WORKSHOP_STAGE_DELIVERABLE_FIELDS,
} from "./workshopStageDeliverables.js";

/** Campos con auto-guardado cuyo baseline vive en `project.*` (resuelto por etapa). */
export const WORKSHOP_PERSIST_BASELINE_FIELDS = [
  ...WORKSHOP_STAGE_DELIVERABLE_FIELDS,
  "dbgaContent",
  "mddContent",
] as const;

type PersistBaselineProject = Record<string, unknown> & {
  stages?: Array<{ id: string; mddContent?: string | null } & Record<string, unknown>>;
};

/** Baseline persistido antes del PATCH (misma resolución que `useAutoSaveContent` → `project.*`). */
export function resolvePersistFieldBaseline(
  field: string,
  project: PersistBaselineProject,
  activeStageId: string | null,
): string {
  if (field === "mddContent") {
    const stages = project.stages ?? [];
    if (activeStageId && stages.length) {
      const st = stages.find((s) => s.id === activeStageId);
      if (st && st.mddContent != null) return String(st.mddContent);
    }
    return String(project.mddContent ?? "");
  }
  if (isStageScopedDeliverableField(field)) {
    const deliverables = resolveWorkshopStageDeliverables(
      { ...project, stages: project.stages ?? [] },
      activeStageId,
    );
    return String(deliverables[field] ?? "");
  }
  return String(project[field] ?? "");
}

/**
 * Tras PATCH de un campo, evita desalinear baselines de otros campos no editados:
 * si local === baseline previo, conserva ese valor en `project` en lugar del snapshot del servidor.
 */
export function mergeProjectBaselinesAfterPersist(
  nextProject: PersistBaselineProject,
  options: {
    savedField: string;
    prevProject: PersistBaselineProject;
    activeStageId: string | null;
    localFields: Record<string, string | null | undefined>;
  },
): PersistBaselineProject {
  const { savedField, prevProject, activeStageId, localFields } = options;
  const merged: PersistBaselineProject = { ...nextProject };
  for (const field of WORKSHOP_PERSIST_BASELINE_FIELDS) {
    if (field === savedField) continue;
    const local = localFields[field];
    const prevBaseline = resolvePersistFieldBaseline(field, prevProject, activeStageId);
    if (String(local ?? "") === String(prevBaseline ?? "")) {
      merged[field] = local ?? null;
    }
  }
  return merged;
}

/**
 * Tras un PATCH, no sobrescribir el estado local del editor si el usuario siguió escribiendo.
 */
export function shouldApplyPersistedFieldContent(
  localNow: string,
  localAtSaveStart: string,
  savedPayload: string,
): boolean {
  if (localNow === localAtSaveStart) return true;
  if (localNow === savedPayload) return true;
  return false;
}
