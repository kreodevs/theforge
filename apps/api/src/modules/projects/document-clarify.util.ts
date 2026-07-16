import type { ClarifyableDocumentField, ProjectDeliverableSource } from "@theforge/shared-types";
import { documentPersistFieldLabel } from "@theforge/shared-types";
import type { Project, Stage } from "@theforge/database";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { persistStageAndProjectDeliverables } from "./stage-deliverable-persist.util.js";
import { stampMarkdownIfBodyChanged } from "../engine/document-date-header.util.js";

type ProjectWithStages = Project & { stages: Stage[] };

const PROJECT_ONLY_FIELDS = new Set<ClarifyableDocumentField>(["dbgaContent"]);

const STAGE_DIRECT_FIELDS = new Set<ClarifyableDocumentField>(["mddContent", "brdContent"]);

export function readClarifyDocumentContent(
  project: ProjectWithStages,
  stage: Stage | null | undefined,
  deliverables: ProjectDeliverableSource,
  field: ClarifyableDocumentField,
): string {
  if (field === "dbgaContent") {
    return (project.dbgaContent ?? "").trim();
  }
  if (field === "mddContent") {
    return (stage?.mddContent ?? "").trim();
  }
  if (field === "brdContent") {
    return (stage?.brdContent ?? "").trim();
  }
  const fromDeliverables = deliverables[field as keyof ProjectDeliverableSource];
  if (typeof fromDeliverables === "string" && fromDeliverables.trim()) {
    return fromDeliverables.trim();
  }
  const fromProject = project[field as keyof Project];
  return typeof fromProject === "string" ? fromProject.trim() : "";
}

export function clarifyDocumentFieldLabel(field: ClarifyableDocumentField): string {
  return documentPersistFieldLabel(field);
}

export async function persistClarifyDocumentContent(
  prisma: PrismaService,
  projectId: string,
  stageId: string | null | undefined,
  field: ClarifyableDocumentField,
  previous: string,
  next: string,
): Promise<void> {
  const stamped = stampMarkdownIfBodyChanged(previous, next);

  if (field === "dbgaContent") {
    await prisma.project.update({
      where: { id: projectId },
      data: { dbgaContent: stamped },
    });
    return;
  }

  if (!stageId) {
    throw new Error(`stageId requerido para persistir ${field}`);
  }

  if (field === "mddContent") {
    await prisma.stage.update({
      where: { id: stageId },
      data: { mddContent: stamped },
    });
    return;
  }

  if (field === "brdContent") {
    await prisma.stage.update({
      where: { id: stageId },
      data: { brdContent: stamped },
    });
    return;
  }

  if (PROJECT_ONLY_FIELDS.has(field)) {
    await prisma.project.update({
      where: { id: projectId },
      data: { [field]: stamped },
    });
    return;
  }

  await persistStageAndProjectDeliverables(prisma, stageId, projectId, {
    [field]: stamped,
  } as ProjectDeliverableSource);
}

export function buildClarifyContextDocs(
  project: ProjectWithStages,
  stage: Stage | null | undefined,
  deliverables: ProjectDeliverableSource,
  targetField: ClarifyableDocumentField,
): Record<string, string> {
  const ctx: Record<string, string> = {};
  const maybeAdd = (label: string, field: ClarifyableDocumentField) => {
    if (field === targetField) return;
    const text = readClarifyDocumentContent(project, stage, deliverables, field);
    if (text.trim()) ctx[label] = text;
  };
  maybeAdd("DBGA / Fase 0", "dbgaContent");
  maybeAdd("Spec", "specContent");
  maybeAdd("BRD", "brdContent");
  maybeAdd("MDD", "mddContent");
  return ctx;
}

export function isStageRequiredField(field: ClarifyableDocumentField): boolean {
  return STAGE_DIRECT_FIELDS.has(field) || !PROJECT_ONLY_FIELDS.has(field);
}
