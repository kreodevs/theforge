/** Minimal stage shape for default-stage selection (avoids importing full workshop store). */
export type WorkshopStagePickInput = {
  id: string;
  ordinal: number;
  workflowStatus: string;
};

/** Prefer first ACTIVE stage by ordinal; otherwise lowest ordinal. */
export function pickDefaultStageId(stages: WorkshopStagePickInput[]): string | null {
  if (!stages.length) return null;
  const active = stages
    .filter((s) => s.workflowStatus === "ACTIVE")
    .sort((a, b) => a.ordinal - b.ordinal);
  if (active.length > 0) return active[0]!.id;
  return [...stages].sort((a, b) => a.ordinal - b.ordinal)[0]!.id;
}
