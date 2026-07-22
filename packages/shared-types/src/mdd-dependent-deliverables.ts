import type { ProjectDeliverableSource } from "./stage-deliverable-snapshot.js";

/** Entregables SDD en columnas Stage (y espejo flat en Project). */
export const MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS = [
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
] as const satisfies readonly (keyof ProjectDeliverableSource)[];

/** Solo en Project (no existe columna en Stage — ver stage-deliverable-persist.util). */
export const MDD_DEPENDENT_PROJECT_ONLY_DELIVERABLE_KEYS = [
  "uiScreensContent",
] as const satisfies readonly (keyof ProjectDeliverableSource)[];

/** Todos los entregables MDD-dependent (log / UI). */
export const MDD_DEPENDENT_DELIVERABLE_KEYS = [
  ...MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS,
  ...MDD_DEPENDENT_PROJECT_ONLY_DELIVERABLE_KEYS,
] as const satisfies readonly (keyof ProjectDeliverableSource)[];

export type MddDependentDeliverableKey = (typeof MDD_DEPENDENT_DELIVERABLE_KEYS)[number];

export function buildClearMddDependentStageDeliverablesPayload(): Record<
  (typeof MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS)[number],
  null
> {
  return Object.fromEntries(
    MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS.map((key) => [key, null]),
  ) as Record<(typeof MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS)[number], null>;
}

export function buildClearMddDependentProjectDeliverablesPayload(): Record<
  MddDependentDeliverableKey,
  null
> {
  return Object.fromEntries(
    MDD_DEPENDENT_DELIVERABLE_KEYS.map((key) => [key, null]),
  ) as Record<MddDependentDeliverableKey, null>;
}
