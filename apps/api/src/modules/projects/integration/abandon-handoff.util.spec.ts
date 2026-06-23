import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handoffItemIdsFromStageSnapshot,
  pickActivateStageIdAfterAbandon,
  releaseHandoffItemsForAbandonedStage,
} from "./abandon-handoff.util.js";

describe("handoffItemIdsFromStageSnapshot", () => {
  it("extracts ids from snapshot items", () => {
    assert.deepEqual(
      handoffItemIdsFromStageSnapshot({
        items: [{ id: "NEW-LEG-01" }, { id: "NEW-LEG-02" }],
      }),
      ["NEW-LEG-01", "NEW-LEG-02"],
    );
  });
});

describe("releaseHandoffItemsForAbandonedStage", () => {
  it("clears legacyStageId and resets accepted to sent", () => {
    const { items, releasedIds } = releaseHandoffItemsForAbandonedStage(
      [
        {
          id: "NEW-LEG-01",
          title: "A",
          description: "d",
          status: "accepted",
          legacyStageId: "stage-2",
        },
        {
          id: "NEW-LEG-02",
          title: "B",
          description: "d",
          status: "sent",
        },
      ],
      "stage-2",
      ["NEW-LEG-01"],
      false,
    );
    assert.deepEqual(releasedIds, ["NEW-LEG-01"]);
    assert.equal(items[0]?.legacyStageId, undefined);
    assert.equal(items[0]?.status, "sent");
    assert.equal(items[1]?.status, "sent");
  });

  it("marks released items rejected when requested", () => {
    const { items } = releaseHandoffItemsForAbandonedStage(
      [
        {
          id: "NEW-LEG-01",
          title: "A",
          description: "d",
          status: "sent",
          legacyStageId: "stage-2",
        },
      ],
      "stage-2",
      [],
      true,
    );
    assert.equal(items[0]?.status, "rejected");
    assert.equal(items[0]?.legacyStageId, undefined);
  });
});

describe("pickActivateStageIdAfterAbandon", () => {
  const stages = [
    { id: "s1", ordinal: 1, workflowStatus: "SUPERSEDED" },
    { id: "s2", ordinal: 2, workflowStatus: "ACTIVE" },
    { id: "s3", ordinal: 3, workflowStatus: "DRAFT" },
  ];

  it("prefers explicit activateStageId when valid", () => {
    assert.equal(pickActivateStageIdAfterAbandon(stages, "s2", "s1"), "s1");
  });

  it("activates etapa 1 baseline when abandoning a later active stage", () => {
    assert.equal(pickActivateStageIdAfterAbandon(stages, "s2"), "s1");
  });
});
