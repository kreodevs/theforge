import {
  pickDeliverableFieldsFromSource,
  readStageDeliverableSnapshot,
  resolveLiveStageDeliverables,
  type ProjectDeliverableSource,
  type StageDeliverableSnapshot,
} from "@theforge/shared-types";
import type { PrismaService } from "../../prisma/prisma.service.js";

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
  "phase0SummaryContent",
  "aemContent",
  "handoffSpecContent",
] as const satisfies readonly (keyof ProjectDeliverableSource)[];

function buildStageUpdateData(fields: ProjectDeliverableSource): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  for (const key of DELIVERABLE_KEYS) {
    if (fields[key] !== undefined) data[key] = fields[key] ?? null;
  }
  return data;
}

/**
 * Writes deliverable fields to Stage (live store) and keeps Project flat fields in sync.
 */
export async function persistStageAndProjectDeliverables(
  prisma: PrismaStageWriter,
  stageId: string,
  projectId: string,
  fields: ProjectDeliverableSource,
): Promise<void> {
  const picked = pickDeliverableFieldsFromSource(fields);
  if (Object.keys(picked).length === 0) return;

  const stageData = buildStageUpdateData(picked);
  const projectData = buildStageUpdateData(picked);

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
        phase0SummaryContent: true,
        aemContent: true,
        handoffSpecContent: true,
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
