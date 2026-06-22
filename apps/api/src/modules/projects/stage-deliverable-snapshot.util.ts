import type { PrismaService } from "../../prisma/prisma.service.js";
import {
  buildStageDeliverableSnapshotFromProject,
  readStageDeliverableSnapshot,
  type ProjectDeliverableSource,
  type StageDeliverableSnapshot,
} from "@theforge/shared-types";

type PrismaStageWriter = Pick<PrismaService, "stage" | "project">;

/**
 * Persists a frozen copy of project deliverable fields on `Stage.deliverableSnapshot`.
 * Used after cascade generation so historical stage views stay read-only.
 */
export async function persistStageDeliverableSnapshotFromProject(
  prisma: PrismaStageWriter,
  stageId: string,
  project: ProjectDeliverableSource,
  options?: { source?: StageDeliverableSnapshot["source"] },
): Promise<void> {
  const snapshot = buildStageDeliverableSnapshotFromProject(project, {
    source: options?.source ?? "cascade",
  });
  await prisma.stage.update({
    where: { id: stageId },
    data: { deliverableSnapshot: snapshot as object },
  });
}

/**
 * Persists snapshot only when the stage has none yet (archive/activate handoff).
 */
export async function ensureStageDeliverableSnapshotIfMissing(
  prisma: PrismaStageWriter,
  stageId: string,
  projectId: string,
  options?: { source?: StageDeliverableSnapshot["source"] },
): Promise<boolean> {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { deliverableSnapshot: true },
  });
  if (readStageDeliverableSnapshot(stage?.deliverableSnapshot)) return false;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;

  await persistStageDeliverableSnapshotFromProject(prisma, stageId, project, options);
  return true;
}
