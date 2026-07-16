import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LONG_JOB_LOCK_DURATION_MS,
  LONG_JOB_LOCK_RENEW_TIME_MS,
  LONG_JOB_STALLED_INTERVAL_MS,
  longRunningBullmqWorkerOptions,
} from "./bullmq-long-job.worker-options.js";

describe("longRunningBullmqWorkerOptions", () => {
  it("uses lock settings suited for multi-minute LLM jobs", () => {
    const opts = longRunningBullmqWorkerOptions();
    assert.equal(opts.lockDuration, LONG_JOB_LOCK_DURATION_MS);
    assert.equal(opts.lockRenewTime, LONG_JOB_LOCK_RENEW_TIME_MS);
    assert.equal(opts.stalledInterval, LONG_JOB_STALLED_INTERVAL_MS);
    assert.ok(opts.lockRenewTime < opts.lockDuration);
    assert.ok(opts.stalledInterval >= opts.lockRenewTime);
  });

  it("allows concurrency override", () => {
    assert.equal(longRunningBullmqWorkerOptions({ concurrency: 1 }).concurrency, 1);
  });
});
