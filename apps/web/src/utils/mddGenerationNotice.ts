import type { ProjectGenerationStatus } from "@theforge/shared-types";

export const MDD_GENERATION_CANCELLED_NOTICE = "Generación cancelada";

export function isLocalMddGenerationLoading(
  loading: boolean,
  loadingReason: string | null | undefined,
): boolean {
  return (
    loading &&
    (loadingReason === "mdd" ||
      loadingReason === "mdd-section" ||
      loadingReason === "legacy-mdd")
  );
}

/** Show the top «Regenerando MDD…» banner with Detener (not after user cancelled). */
export function shouldShowMddRegeneratingBanner(params: {
  generationStatus: ProjectGenerationStatus | null | undefined;
  notice: string | null | undefined;
  mddCancelInFlight: boolean;
  localMddLoading: boolean;
  cascadeRunning: boolean;
}): boolean {
  if (params.cascadeRunning) return false;
  if (params.mddCancelInFlight) return false;
  if (params.notice === MDD_GENERATION_CANCELLED_NOTICE) return false;
  return Boolean(params.generationStatus?.mddStreamActive || params.localMddLoading);
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
