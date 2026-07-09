import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldPreserveWorkshopBusyState } from "./workshopBusyRefresh.js";

describe("shouldPreserveWorkshopBusyState", () => {
  it("returns false when switching projects", () => {
    assert.equal(
      shouldPreserveWorkshopBusyState(
        {
          projectId: "a",
          loading: true,
          loadingReason: "deliverables-cascade",
          streamingUserMessage: null,
          streamingContent: null,
          agentProgress: [{ agent: "Entregables", message: "x", status: "generando" }],
          mddReviewing: false,
          pendingPlanApproval: null,
        },
        "b",
      ),
      false,
    );
  });

  it("returns true for same project with deliverables cascade in progress", () => {
    assert.equal(
      shouldPreserveWorkshopBusyState(
        {
          projectId: "proj-1",
          loading: true,
          loadingReason: "deliverables-cascade",
          streamingUserMessage: null,
          streamingContent: null,
          agentProgress: [{ agent: "Entregables", message: "x", status: "generando" }],
          mddReviewing: false,
          pendingPlanApproval: null,
        },
        "proj-1",
      ),
      true,
    );
  });

  it("returns false when same project is idle", () => {
    assert.equal(
      shouldPreserveWorkshopBusyState(
        {
          projectId: "proj-1",
          loading: false,
          loadingReason: null,
          streamingUserMessage: null,
          streamingContent: null,
          agentProgress: [],
          mddReviewing: false,
          pendingPlanApproval: null,
        },
        "proj-1",
      ),
      false,
    );
  });
});
