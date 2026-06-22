import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLegacyChangeState,
  getLegacyChangeGateInput,
} from "./legacy-change-state.util.js";
import {
  resolveLiveStageDeliverables,
} from "./stage-deliverable-snapshot.js";

describe("getLegacyChangeState", () => {
  it("returns empty object when stage state is missing", () => {
    assert.deepEqual(getLegacyChangeState(null), {});
    assert.deepEqual(getLegacyChangeState({}), {});
  });

  it("reads legacyChangeState from stage", () => {
    assert.deepEqual(
      getLegacyChangeState({ legacyChangeState: { description: "Delta" } }),
      { description: "Delta" },
    );
  });
});

describe("getLegacyChangeGateInput", () => {
  it("maps stage fields for gate evaluation", () => {
    const input = getLegacyChangeGateInput({
      ordinal: 2,
      legacyChangeState: { description: "Change" },
      handoffImportedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(input.ordinal, 2);
    assert.equal(input.legacyChangeState?.description, "Change");
  });
});

describe("resolveLiveStageDeliverables", () => {
  it("prefers stage fields when present", () => {
    const resolved = resolveLiveStageDeliverables(
      { specContent: "# Stage spec", tasksContent: "- [ ] A" },
      { specContent: "# Project spec", tasksContent: "- [ ] B" },
    );
    assert.equal(resolved.specContent, "# Stage spec");
    assert.equal(resolved.tasksContent, "- [ ] A");
  });

  it("falls back to project when stage field empty", () => {
    const resolved = resolveLiveStageDeliverables(
      { specContent: "  " },
      { specContent: "# Project spec" },
    );
    assert.equal(resolved.specContent, "# Project spec");
  });
});
