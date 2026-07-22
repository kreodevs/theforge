import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@theforge/database";
import {
  buildProjectClearMddDependentDeliverablesUpdate,
  buildStageClearMddDependentDeliverablesUpdate,
} from "./clear-mdd-dependent-deliverables.util.js";
import {
  MDD_DEPENDENT_DELIVERABLE_KEYS,
  MDD_DEPENDENT_PROJECT_ONLY_DELIVERABLE_KEYS,
  MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS,
} from "@theforge/shared-types";

describe("clear-mdd-dependent-deliverables.util", () => {
  it("buildProjectClearMddDependentDeliverablesUpdate nulls stage + project-only fields and tasksJson", () => {
    const payload = buildProjectClearMddDependentDeliverablesUpdate();
    for (const key of MDD_DEPENDENT_DELIVERABLE_KEYS) {
      assert.equal(payload[key], null);
    }
    assert.equal(payload.tasksJson, Prisma.JsonNull);
    assert.equal(
      Object.keys(payload).length,
      MDD_DEPENDENT_DELIVERABLE_KEYS.length + 1,
    );
  });

  it("buildStageClearMddDependentDeliverablesUpdate omits project-only uiScreensContent", () => {
    const payload = buildStageClearMddDependentDeliverablesUpdate({
      pendingCascadeDelta: { affectedDeliverables: ["spec"] },
      other: "keep",
    });
    for (const key of MDD_DEPENDENT_STAGE_DELIVERABLE_KEYS) {
      assert.equal(payload[key], null);
    }
    for (const key of MDD_DEPENDENT_PROJECT_ONLY_DELIVERABLE_KEYS) {
      assert.equal((payload as Record<string, unknown>)[key], undefined);
    }
    assert.equal(payload.changeSpecContent, null);
    assert.ok(payload.deliverableSnapshot);
    assert.deepEqual(payload.shortTermContext, {
      other: "keep",
      pendingCascadeDelta: null,
    });
    assert.equal(payload.tasksJson, Prisma.JsonNull);
  });
});
