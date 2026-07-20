import type { Project } from "@theforge/database";
import { rebuildDomainInventoryPreferringBrd } from "../engine/domain-inventory-persist.util.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { buildConstitutionMarkdown } from "./constitution-markdown.util.js";
import { pickPrimaryStage, type StageWithEstimation } from "./stage-helpers.js";

/** Persist Stage.domainInventory SSOT from BRD + MDD (idempotent). */
export async function syncDomainInventoryForStage(
  prisma: PrismaService,
  project: Project & { stages: StageWithEstimation[] },
  stageId?: string | null,
): Promise<void> {
  const stage =
    (stageId && project.stages.find((s) => s.id === stageId)) || pickPrimaryStage(project.stages);
  if (!stage?.id) return;
  const inventory = rebuildDomainInventoryPreferringBrd({
    brdMarkdown: stage.brdContent,
    dbgaMarkdown: project.dbgaContent,
    mddMarkdown: buildConstitutionMarkdown(project),
  });
  if (inventory.capabilities.length === 0 && inventory.suggestedEntities.length === 0) return;
  await prisma.stage.update({
    where: { id: stage.id },
    data: { domainInventory: inventory as object },
  });
}
