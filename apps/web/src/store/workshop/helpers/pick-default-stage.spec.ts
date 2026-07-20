import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickDefaultStageId } from "./pick-default-stage.js";

describe("pickDefaultStageId", () => {
  it("returns null for empty stages", () => {
    assert.equal(pickDefaultStageId([]), null);
  });

  it("prefers ACTIVE stage with lowest ordinal", () => {
    assert.equal(
      pickDefaultStageId([
        { id: "b", ordinal: 2, workflowStatus: "ACTIVE" },
        { id: "a", ordinal: 1, workflowStatus: "ACTIVE" },
        { id: "c", ordinal: 0, workflowStatus: "DRAFT" },
      ]),
      "a",
    );
  });

  it("falls back to lowest ordinal when none are ACTIVE", () => {
    assert.equal(
      pickDefaultStageId([
        { id: "b", ordinal: 2, workflowStatus: "DRAFT" },
        { id: "a", ordinal: 1, workflowStatus: "DRAFT" },
      ]),
      "a",
    );
  });
});
