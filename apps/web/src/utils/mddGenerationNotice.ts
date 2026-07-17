import type { ProjectGenerationStatus } from "@theforge/shared-types";

export const MDD_GENERATION_CANCELLED_NOTICE = "Generación cancelada";

/** Hide stale "Generación cancelada" when backend reports MDD or other generation still running. */
export function shouldClearCancelledNotice(
  status: ProjectGenerationStatus | null | undefined,
  notice: string | null | undefined,
): boolean {
  if (notice !== MDD_GENERATION_CANCELLED_NOTICE) return false;
  return Boolean(status?.busy || status?.mddStreamActive);
}

/** Optimistically hide the regenerating banner while cancel is in flight. */
export function optimisticallyClearMddStreamStatus(
  status: ProjectGenerationStatus | null | undefined,
): ProjectGenerationStatus | null {
  if (!status) return null;
  return {
    ...status,
    busy: false,
    mddStreamActive: false,
    activeJob: null,
    queuedJobs: [],
  };
}
