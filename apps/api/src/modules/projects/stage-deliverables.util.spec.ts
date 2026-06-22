import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStageDeliverables } from "./stage-deliverables.util.js";

describe("resolveStageDeliverables", () => {
  const project = {
    specContent: "# Project spec",
    tasksContent: "- [ ] Project",
  };

  it("prefers live stage deliverables for ACTIVE stage", () => {
    const result = resolveStageDeliverables(
      project,
      {
        id: "st-1",
        ordinal: 1,
        workflowStatus: "ACTIVE",
        specContent: "# Stage spec",
        tasksContent: "- [ ] Stage",
      },
      "workshop",
    );
    assert.equal(result.source, "live");
    assert.equal(result.deliverables.specContent, "# Stage spec");
    assert.equal(result.deliverables.tasksContent, "- [ ] Stage");
  });

  it("falls back to project when stage fields empty", () => {
    const result = resolveStageDeliverables(
      project,
      {
        id: "st-1",
        ordinal: 1,
        workflowStatus: "ACTIVE",
        specContent: null,
      },
      "workshop",
    );
    assert.equal(result.deliverables.specContent, "# Project spec");
  });

  it("serves snapshot for archived stage in workshop mode", () => {
    const result = resolveStageDeliverables(
      project,
      {
        id: "st-old",
        ordinal: 1,
        workflowStatus: "ARCHIVED",
        deliverableSnapshot: {
          capturedAt: "2026-01-01T00:00:00.000Z",
          specContent: "# Snapshot spec",
        },
      },
      "workshop",
    );
    assert.equal(result.source, "snapshot");
    assert.equal(result.readOnly, true);
    assert.equal(result.deliverables.specContent, "# Snapshot spec");
  });
});
