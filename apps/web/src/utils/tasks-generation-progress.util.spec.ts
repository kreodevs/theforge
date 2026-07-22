import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTasksPipelineProgress,
  createTasksGenerationProgressItems,
} from "./tasks-generation-progress.util.js";

describe("tasks-generation-progress", () => {
  it("marca redactor activo con lote", () => {
    const items = applyTasksPipelineProgress(createTasksGenerationProgressItems(), {
      phase: "redactor",
      batch: 2,
      totalBatches: 5,
      message: "Redactando lote 2/5",
    });
    assert.equal(items[0]?.status, "terminado");
    assert.equal(items[1]?.status, "generando");
    assert.match(items[1]?.message ?? "", /Redactando lote 2\/5/);
  });
});
