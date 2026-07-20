import type { MddUpstreamSyncStatus, ProjectGenerationStatus } from "@theforge/shared-types";

export function mergeGenerationStatusWithMddUpstreamSync(
  status: ProjectGenerationStatus | null | undefined,
  sync: MddUpstreamSyncStatus | null | undefined,
): ProjectGenerationStatus | null {
  if (!sync) return status ?? null;
  if (!status) {
    return {
      busy: false,
      mddStreamActive: false,
      mddJobs: [],
      activeJob: null,
      queuedJobs: [],
      gates: {},
      mddUpstreamSync: sync,
    };
  }
  return { ...status, mddUpstreamSync: sync };
}

export const generationStatusPoll = {
  timer: null as ReturnType<typeof setInterval> | null,
  projectId: null as string | null,
};

export function stopGenerationStatusPolling(): void {
  if (generationStatusPoll.timer) {
    clearInterval(generationStatusPoll.timer);
    generationStatusPoll.timer = null;
  }
  generationStatusPoll.projectId = null;
}
