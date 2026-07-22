import { Prisma } from "@theforge/database";
import {
  buildClearMddDependentProjectDeliverablesPayload,
  buildClearMddDependentStageDeliverablesPayload,
} from "@theforge/shared-types";

export function buildProjectClearMddDependentDeliverablesUpdate(): Prisma.ProjectUpdateInput {
  return {
    ...buildClearMddDependentProjectDeliverablesPayload(),
    tasksJson: Prisma.JsonNull,
  };
}

export function buildStageClearMddDependentDeliverablesUpdate(
  shortTermContext: unknown,
): Prisma.StageUpdateInput {
  const prevCtx =
    shortTermContext &&
    typeof shortTermContext === "object" &&
    !Array.isArray(shortTermContext)
      ? (shortTermContext as Record<string, unknown>)
      : {};

  return {
    ...buildClearMddDependentStageDeliverablesPayload(),
    tasksJson: Prisma.JsonNull,
    changeSpecContent: null,
    deliverableSnapshot: Prisma.JsonNull,
    shortTermContext: {
      ...prevCtx,
      pendingCascadeDelta: null,
    } as Prisma.InputJsonValue,
  };
}
