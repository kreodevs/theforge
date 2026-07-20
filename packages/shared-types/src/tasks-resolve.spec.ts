import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTasksForConsume, hasValidTasksJson } from "./tasks-resolve.js";

describe("resolveTasksForConsume", () => {
  it("prefers tasksJson when valid", () => {
    const json = { version: "2.0", tasks: [{ id: "T-001" }] };
    const r = resolveTasksForConsume({
      tasksContent: "# Tasks\n---\nid: T-999",
      tasksJson: json,
    });
    assert.equal(r.source, "tasksJson");
    assert.equal(r.hasTasksJson, true);
    assert.equal(r.taskCount, 1);
  });

  it("falls back to tasksContent when hasTasksJson false", () => {
    const md = "# Tasks\n\n---\nid: T-001\n---\n";
    const r = resolveTasksForConsume({ tasksContent: md, tasksJson: null });
    assert.equal(r.source, "tasksContent");
    assert.equal(r.hasTasksJson, false);
    assert.ok(r.markdown?.includes("T-001"));
  });

  it("hasValidTasksJson detects structured store", () => {
    assert.equal(hasValidTasksJson({ tasks: [{ id: "T-001" }] }), true);
    assert.equal(hasValidTasksJson({ tasks: [] }), false);
    assert.equal(hasValidTasksJson(null), false);
  });
});
