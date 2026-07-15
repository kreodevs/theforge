import {
  pickDeliverableFieldsFromSource,
  readStageDeliverableSnapshot,
  resolveLiveStageDeliverables,
  type ProjectDeliverableSource,
  type StageDeliverableSnapshot,
} from "@theforge/shared-types";
import { Prisma } from "@theforge/database";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { parseTasksV2 } from "../engine/task-v2/tasks-parser-v2.js";
import { prependDocumentTimestamps } from "../engine/document-date-header.util.js";

type PrismaStageWriter = Pick<PrismaService, "stage" | "project" | "$transaction">;

export type StageDeliverableRow = ProjectDeliverableSource;

const DELIVERABLE_KEYS = [
  "specContent",
  "architectureContent",
  "useCasesContent",
  "userStoriesContent",
  "blueprintContent",
  "tasksContent",
  "apiContractsContent",
  "logicFlowsContent",
  "infraContent",
  "agentGovernanceContent",
  "uxUiGuideContent",
  "uiScreensContent",
  "phase0SummaryContent",
  "aemContent",
] as const satisfies readonly (keyof ProjectDeliverableSource)[];

/** JSON borrador Fase 0 — no recibe cabecera markdown. */
const STAMP_EXCLUDED_DELIVERABLE_KEYS = new Set<keyof ProjectDeliverableSource>([
  "phase0SummaryContent",
]);

function buildStageUpdateData(fields: ProjectDeliverableSource): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  for (const key of DELIVERABLE_KEYS) {
    if (fields[key] !== undefined) data[key] = fields[key] ?? null;
  }
  return data;
}

/**
 * Writes deliverable fields to Stage (live store) and keeps Project flat fields in sync.
 * Also auto-parses tasksContent into tasksJson v2 when present.
 */
export async function persistStageAndProjectDeliverables(
  prisma: PrismaStageWriter,
  stageId: string,
  projectId: string,
  fields: ProjectDeliverableSource,
): Promise<void> {
  const picked = pickDeliverableFieldsFromSource(fields);
  if (Object.keys(picked).length === 0) return;

  const stageData: Record<string, unknown> = buildStageUpdateData(picked);
  const projectData: Record<string, unknown> = buildStageUpdateData(picked);

  // Prepend creation / updated timestamp header to every text deliverable
  const now = new Date();
  for (const key of DELIVERABLE_KEYS) {
    const val = stageData[key];
    if (
      !STAMP_EXCLUDED_DELIVERABLE_KEYS.has(key) &&
      typeof val === "string" &&
      val.trim().length > 0
    ) {
      const stamped = prependDocumentTimestamps(val, now);
      stageData[key] = stamped;
      projectData[key] = stamped;
    }
  }

  // Auto-parse tasks v2 into structured JSON
  if (typeof picked.tasksContent === "string" && picked.tasksContent.trim().length > 0) {
    try {
      const parsed = parseTasksV2(picked.tasksContent);
      if (parsed.tasks.length > 0) {
        stageData.tasksJson = parsed as unknown as Prisma.InputJsonValue;
        projectData.tasksJson = parsed as unknown as Prisma.InputJsonValue;
      }
    } catch {
      // Silently ignore parse errors; tasksJson remains untouched
    }
  }

  await prisma.$transaction([
    prisma.stage.update({ where: { id: stageId }, data: stageData }),
    prisma.project.update({ where: { id: projectId }, data: projectData }),
  ]);
}

/**
 * Seeds live deliverable columns on a newly activated stage from prior snapshot or project flat fields.
 */
export async function seedActiveStageDeliverables(
  prisma: PrismaStageWriter,
  stageId: string,
  projectId: string,
  options?: { previousStageId?: string | null },
): Promise<void> {
  const [stage, project, previousStage] = await Promise.all([
    prisma.stage.findUnique({
      where: { id: stageId },
      select: {
        specContent: true,
        architectureContent: true,
        useCasesContent: true,
        userStoriesContent: true,
        blueprintContent: true,
        tasksContent: true,
        apiContractsContent: true,
        logicFlowsContent: true,
        infraContent: true,
        agentGovernanceContent: true,
        uxUiGuideContent: true,
        uiScreensContent: true,
        phase0SummaryContent: true,
        aemContent: true,
      },
    }),
    prisma.project.findUnique({ where: { id: projectId } }),
    options?.previousStageId?.trim()
      ? prisma.stage.findUnique({
          where: { id: options.previousStageId.trim() },
          select: { deliverableSnapshot: true },
        })
      : Promise.resolve(null),
  ]);

  if (!stage || !project) return;

  const hasAnyStageContent = DELIVERABLE_KEYS.some((key) => {
    const value = stage[key];
    return typeof value === "string" && value.trim().length > 0;
  });
  if (hasAnyStageContent) return;

  const snapshot = readStageDeliverableSnapshot(previousStage?.deliverableSnapshot);
  const source: ProjectDeliverableSource = snapshot
    ? DELIVERABLE_KEYS.reduce<ProjectDeliverableSource>((acc, key) => {
        acc[key] = snapshot[key] ?? project[key] ?? null;
        return acc;
      }, {})
    : pickDeliverableFieldsFromSource(project);

  await persistStageAndProjectDeliverables(prisma, stageId, projectId, source);
}

export function resolveStageDeliverableSource(
  stage: StageDeliverableRow & { deliverableSnapshot?: unknown },
  project: ProjectDeliverableSource,
  options?: { snapshot?: StageDeliverableSnapshot | null },
): ProjectDeliverableSource {
  const snapshot = options?.snapshot ?? readStageDeliverableSnapshot(stage.deliverableSnapshot);
  if (snapshot) {
    const merged: ProjectDeliverableSource = {};
    for (const key of DELIVERABLE_KEYS) {
      merged[key] = snapshot[key] ?? project[key] ?? null;
    }
    return merged;
  }
  return resolveLiveStageDeliverables(stage, project);
}
