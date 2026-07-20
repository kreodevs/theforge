/**
 * Atomic persist of cross-artifact bundle (US + pantallas + API + tasks) with shared version stamp.
 */

import {
  buildDeliverableBundleVersion,
  type DeliverableBundleArtifactKey,
  type ProjectDeliverableSource,
} from "@theforge/shared-types";
import type { Prisma } from "@theforge/database";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { persistStageAndProjectDeliverables } from "./stage-deliverable-persist.util.js";
import { buildStageDeliverableSnapshotFromProject } from "@theforge/shared-types";

const BUNDLE_KEYS: DeliverableBundleArtifactKey[] = [
  "userStoriesContent",
  "uiScreensContent",
  "apiContractsContent",
  "tasksContent",
];

export type DeliverableBundlePersistInput = Pick<
  ProjectDeliverableSource,
  DeliverableBundleArtifactKey
>;

/** Persists bundle artifacts in one transaction with aligned bundleVersion in snapshot. */
export async function persistDeliverableBundleAtomic(
  prisma: Pick<PrismaService, "stage" | "project" | "$transaction">,
  stageId: string,
  projectId: string,
  fields: DeliverableBundlePersistInput,
): Promise<{ bundleVersion: string }> {
  const bundleVersion = buildDeliverableBundleVersion();
  const generatedAt = new Date().toISOString();

  await persistStageAndProjectDeliverables(prisma, stageId, projectId, fields);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { bundleVersion };

  const snapshot = buildStageDeliverableSnapshotFromProject(project, {
    capturedAt: generatedAt,
    source: "cascade",
  });
  const snapshotWithBundle = {
    ...snapshot,
    bundleVersion,
    bundleGeneratedAt: generatedAt,
  };

  await prisma.stage.update({
    where: { id: stageId },
    data: {
      deliverableSnapshot: snapshotWithBundle as unknown as Prisma.InputJsonValue,
    },
  });

  return { bundleVersion };
}

export function pickDeliverableBundleFields(
  project: ProjectDeliverableSource,
): DeliverableBundlePersistInput {
  const out: DeliverableBundlePersistInput = {};
  for (const key of BUNDLE_KEYS) {
    if (project[key] !== undefined) out[key] = project[key] ?? null;
  }
  return out;
}
