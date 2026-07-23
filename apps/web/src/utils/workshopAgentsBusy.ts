import type { ProjectGenerationStatus } from "@theforge/shared-types";

/** Slice mínimo del workshop store para saber si hay trabajo de agentes en curso. */
export type WorkshopAgentsBusySlice = {
  loading: boolean;
  /** Jobs activos/en cola en el servidor (BullMQ); sobreviven cerrar pestaña o cambiar de proyecto. */
  generationStatus?: ProjectGenerationStatus | null;
  loadingReason:
    | "benchmark"
    | "mdd"
    | "mdd-section"
    | "phase0-deep-research"
    | "legacy-codebase-doc"
    | "legacy-mdd"
    | "legacy-as-is"
    | "legacy-brd-suggest"
    | "brd-from-dbga"
    | "legacy-deliverables"
    | "deliverables-cascade"
    | "repair-sdd-gaps"
    | "agent-governance"
    | "tasks"
    | "converge"
    | "tasks-to-issues"
    | "clarify-spec"
    | "clarify-document"
    | "resolve-clarifications"
    | "aem"
    | null;
  streamingUserMessage: string | null;
  streamingContent: string | null;
  agentProgress: ReadonlyArray<unknown>;
  mddReviewing: boolean;
  pendingPlanApproval: unknown | null;
};

const AGENT_LOADING_REASONS = new Set<NonNullable<WorkshopAgentsBusySlice["loadingReason"]>>([
  "benchmark",
  "mdd",
  "mdd-section",
  "phase0-deep-research",
  "legacy-codebase-doc",
  "legacy-mdd",
  "legacy-as-is",
  "legacy-brd-suggest",
  "brd-from-dbga",
  "legacy-deliverables",
  "deliverables-cascade",
  "repair-sdd-gaps",
  "agent-governance",
  "tasks",
  "converge",
  "tasks-to-issues",
  "clarify-spec",
  "clarify-document",
  "resolve-clarifications",
  "aem",
]);

/** `loadingReason` cuya ejecución continúa en el servidor aunque el usuario salga del Workshop. */
const SERVER_QUEUED_LOADING_REASONS = new Set<NonNullable<WorkshopAgentsBusySlice["loadingReason"]>>([
  "mdd",
  "mdd-section",
  "legacy-mdd",
  "deliverables-cascade",
  "legacy-deliverables",
  "repair-sdd-gaps",
  "tasks",
  "agent-governance",
]);

/** Trabajo encolado en servidor (MDD, cascadas, entregables). No debe bloquear salir del proyecto. */
export function isServerSideQueuedWork(s: WorkshopAgentsBusySlice): boolean {
  if (s.generationStatus?.busy === true) return true;
  if (!s.loading || !s.loadingReason) return false;
  return SERVER_QUEUED_LOADING_REASONS.has(s.loadingReason);
}

/** Chat en streaming, Manager MDD, cascadas, benchmark, etc. */
export function isWorkshopAgentsBusy(s: WorkshopAgentsBusySlice): boolean {
  if (s.mddReviewing) return true;
  if (s.pendingPlanApproval != null) return true;
  if (s.streamingUserMessage != null || s.streamingContent != null) return true;
  const serverQueued = isServerSideQueuedWork(s);
  if (s.agentProgress.length > 0 && !serverQueued) return true;
  if (!s.loading) return false;
  if (serverQueued) return false;
  return s.loadingReason != null && AGENT_LOADING_REASONS.has(s.loadingReason);
}

export const WORKSHOP_EXIT_BLOCKED_TITLE =
  "Los agentes siguen trabajando. Espera a que terminen antes de volver al panel de proyectos.";

export const WORKSHOP_DOC_NAV_BLOCKED_TITLE =
  "El chat está procesando un documento. Espera a que termine antes de cambiar de pestaña.";
