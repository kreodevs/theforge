import type { ProjectDeliverableSource } from "./stage-deliverable-snapshot.js";

/** Entregables SDD regenerados desde el MDD (no incluye Fase 0, AEM ni el MDD mismo). */
export const MDD_DEPENDENT_DELIVERABLE_KEYS = [
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
] as const satisfies readonly (keyof ProjectDeliverableSource)[];

export type MddDependentDeliverableKey = (typeof MDD_DEPENDENT_DELIVERABLE_KEYS)[number];

/** Payload nulo para limpiar entregables dependientes del MDD en Project/Stage. */
export function buildClearMddDependentDeliverablesPayload(): Record<MddDependentDeliverableKey, null> {
  return Object.fromEntries(
    MDD_DEPENDENT_DELIVERABLE_KEYS.map((key) => [key, null]),
  ) as Record<MddDependentDeliverableKey, null>;
}
