import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MDD_GENERATION_CANCELLED_NOTICE,
  isLocalMddGenerationLoading,
  optimisticallyClearMddStreamStatus,
  shouldShowMddRegeneratingBanner,
} from "./mddGenerationNotice.js";

describe("mddGenerationNotice", () => {
  it("detects local MDD loading reasons", () => {
    assert.equal(isLocalMddGenerationLoading(true, "mdd"), true);
    assert.equal(isLocalMddGenerationLoading(true, "mdd-section"), true);
    assert.equal(isLocalMddGenerationLoading(true, "legacy-mdd"), true);
    assert.equal(isLocalMddGenerationLoading(true, "deliverables-cascade"), false);
    assert.equal(isLocalMddGenerationLoading(false, "mdd"), false);
  });

  it("hides regenerating banner after cancel notice", () => {
    assert.equal(
      shouldShowMddRegeneratingBanner({
        generationStatus: {
          busy: true,
          mddStreamActive: true,
          activeJob: null,
          queuedJobs: [],
          gates: {},
        },
        notice: MDD_GENERATION_CANCELLED_NOTICE,
        mddCancelInFlight: false,
        localMddLoading: false,
        cascadeRunning: false,
      }),
      false,
    );
  });

  it("shows regenerating banner for background MDD job", () => {
    assert.equal(
      shouldShowMddRegeneratingBanner({
        generationStatus: {
          busy: true,
          mddStreamActive: true,
          activeJob: null,
          queuedJobs: [],
          gates: {},
        },
        notice: null,
        mddCancelInFlight: false,
        localMddLoading: false,
        cascadeRunning: false,
      }),
      true,
    );
  });

  it("shows regenerating banner while local poll is active", () => {
    assert.equal(
      shouldShowMddRegeneratingBanner({
        generationStatus: null,
        notice: null,
        mddCancelInFlight: false,
        localMddLoading: true,
        cascadeRunning: false,
      }),
      true,
    );
  });

  it("hides regenerating banner while cancel is in flight", () => {
    assert.equal(
      shouldShowMddRegeneratingBanner({
        generationStatus: {
          busy: true,
          mddStreamActive: true,
          activeJob: null,
          queuedJobs: [],
          gates: {},
        },
        notice: null,
        mddCancelInFlight: true,
        localMddLoading: true,
        cascadeRunning: false,
      }),
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
