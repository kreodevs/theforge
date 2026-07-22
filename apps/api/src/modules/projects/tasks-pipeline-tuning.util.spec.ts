import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  mapWithConcurrency,
  resolveTasksPipelineMaxRepairs,
  resolveTasksRedactorBatchSize,
} from "./tasks-pipeline-tuning.util.js";

describe("tasks-pipeline-tuning", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("resolveTasksRedactorBatchSize respeta env", () => {
    process.env.TASKS_REDACTOR_BATCH_SIZE = "30";
    assert.equal(resolveTasksRedactorBatchSize(), 30);
  });

  it("resolveTasksPipelineMaxRepairs truncado usa techo env", () => {
    process.env.TASKS_PIPELINE_MAX_REPAIRS_TRUNCATED = "2";
    assert.equal(
      resolveTasksPipelineMaxRepairs({ truncated: true, taskDeficitRatio: 1 }),
      2,
    );
  });

  it("mapWithConcurrency preserva orden", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    assert.deepEqual(out, [10, 20, 30, 40]);
  });
});
