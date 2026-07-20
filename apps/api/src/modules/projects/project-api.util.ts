import type { Estimation, Stage } from "@theforge/database";
import type { ProjectDeliverableSource } from "@theforge/shared-types";
import { flattenStageDeliverables } from "./stage-helpers.js";

type StageWithEst = Stage & { estimation: Estimation | null };

/** Proyecto completo aplanado para API (MDD/semáforo desde etapa principal). */
export function toApiProject<P extends { stages: StageWithEst[] } & Record<string, unknown>>(project: P) {
  const flat = flattenStageDeliverables(project.stages, project as ProjectDeliverableSource);
  const group = project.group as { name: string } | undefined;
  const { group: _g, ...rest } = project;
  return {
    ...rest,
    ...flat,
    groupId: project.groupId as string,
    groupName: group?.name,
  };
}
