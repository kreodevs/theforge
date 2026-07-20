import { NotFoundException } from "@nestjs/common";
import type { Project } from "@theforge/database";
import { getRequestUserId } from "../../common/request-user.store.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { StageWithEstimation } from "./stage-helpers.js";

/** Carga proyecto con etapas si el usuario actual es owner o el proyecto es SHARED. */
export async function loadAccessibleProjectWithStages(
  prisma: PrismaService,
  projectId: string,
): Promise<Project & { stages: StageWithEstimation[] }> {
  const userId = getRequestUserId();
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    include: {
      stages: { orderBy: { ordinal: "asc" }, include: { estimation: true } },
      group: { select: { name: true } },
    },
  });
  if (!project) throw new NotFoundException("Project not found");
  const isOwner = project.userId === userId;
  const isShared = project.visibility === "SHARED";
  if (!isOwner && !isShared) throw new NotFoundException("Project not found");
  return project as Project & { stages: StageWithEstimation[] };
}
