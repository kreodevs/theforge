/**
 * Parches parciales a `legacyChangeState.lastDeliverablesDebug` (stage-scoped).
 * Falls back to `project.legacyFlowState` only when the project has no stages.
 */

import type { PrismaService } from "../../prisma/prisma.service.js";
import type {
  LegacyDeliverablesDebugReport,
  LegacyFlowState,
} from "./legacy-coordinator.service.js";

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

  if (stageId?.trim()) {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId.trim() },
      select: { legacyChangeState: true },
    });
    const state = (stage?.legacyChangeState as LegacyFlowState | null | undefined) ?? {};
    await prisma.stage.update({
      where: { id: stageId.trim() },
      data: { legacyChangeState: applyPatch(state) as object },
    });
    return;
  }

  const stages = await prisma.stage.findMany({
    where: { projectId },
    orderBy: { ordinal: "asc" },
    take: 1,
    select: { id: true, legacyChangeState: true },
  });
  if (stages.length > 0) {
    const state = (stages[0].legacyChangeState as LegacyFlowState | null | undefined) ?? {};
    await prisma.stage.update({
      where: { id: stages[0].id },
      data: { legacyChangeState: applyPatch(state) as object },
    });
    return;
  }

  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { legacyFlowState: true },
  });
  const state = (row?.legacyFlowState as LegacyFlowState | null | undefined) ?? {};
  await prisma.project.update({
    where: { id: projectId },
    data: { legacyFlowState: applyPatch(state) as object },
  });
}
