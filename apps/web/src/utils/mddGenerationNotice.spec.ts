import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MDD_GENERATION_CANCELLED_NOTICE,
  optimisticallyClearMddStreamStatus,
  shouldClearCancelledNotice,
} from "./mddGenerationNotice.js";

describe("mddGenerationNotice", () => {
  it("clears cancel notice when mdd stream is active", () => {
    assert.equal(
      shouldClearCancelledNotice(
        { busy: true, mddStreamActive: true, activeJob: null, queuedJobs: [], gates: {} },
        MDD_GENERATION_CANCELLED_NOTICE,
      ),
      true,
    );
  });

  it("keeps cancel notice when generation is idle", () => {
    assert.equal(
      shouldClearCancelledNotice(
        { busy: false, mddStreamActive: false, activeJob: null, queuedJobs: [], gates: {} },
        MDD_GENERATION_CANCELLED_NOTICE,
      ),
      false,
    );
  });

  it("optimistically clears mdd stream flags", () => {
    const cleared = optimisticallyClearMddStreamStatus({
      busy: true,
      mddStreamActive: true,
      activeJob: { jobId: "8", type: "spec", status: "active" },
      queuedJobs: [{ jobId: "9", type: "blueprint", status: "queued" }],
      gates: {},
    });
    assert.equal(cleared?.busy, false);
    assert.equal(cleared?.mddStreamActive, false);
    assert.equal(cleared?.activeJob, null);
    assert.deepEqual(cleared?.queuedJobs, []);
  });
});
