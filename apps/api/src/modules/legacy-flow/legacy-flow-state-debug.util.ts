/**
 * Parches parciales a `legacyChangeState.lastDeliverablesDebug` (stage-scoped).
 */

import type { PrismaService } from "../../prisma/prisma.service.js";
import type {
  LegacyDeliverablesDebugReport,
  LegacyFlowState,
} from "./legacy-coordinator.service.js";

async function resolveStageForDebug(
  prisma: PrismaService,
  projectId: string,
  stageId?: string | null,
): Promise<{ id: string; legacyChangeState: unknown } | null> {
  if (stageId?.trim()) {
    return prisma.stage.findUnique({
      where: { id: stageId.trim() },
      select: { id: true, legacyChangeState: true },
    });
  }

  const stages = await prisma.stage.findMany({
    where: { projectId },
    orderBy: [{ workflowStatus: "asc" }, { ordinal: "asc" }],
    take: 1,
    select: { id: true, legacyChangeState: true },
  });
  return stages[0] ?? null;
}

export async function patchLegacyDeliverablesDebugReport(
  prisma: PrismaService,
  projectId: string,
  patch: Partial<LegacyDeliverablesDebugReport>,
  stageId?: string | null,
): Promise<void> {
  const applyPatch = (state: LegacyFlowState): LegacyFlowState => {
    const prev = state.lastDeliverablesDebug ?? ({} as LegacyDeliverablesDebugReport);
    return {
      ...state,
      lastDeliverablesDebug: {
        ...prev,
        ...patch,
      },
    };
  };

  const stage = await resolveStageForDebug(prisma, projectId, stageId);
  if (!stage?.id) return;

  const state = (stage.legacyChangeState as LegacyFlowState | null | undefined) ?? {};
  await prisma.stage.update({
    where: { id: stage.id },
    data: { legacyChangeState: applyPatch(state) as object },
  });
}
