import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveProjectTasksSsot } from "./tasks-ssot-resolve.util.js";

describe("resolveProjectTasksSsot", () => {
  it("prefers tasksJson when valid", () => {
    const r = resolveProjectTasksSsot({
      tasksContent: "# Tasks\n- [ ] T-001: Do thing",
      tasksJson: { tasks: [{ id: "T-002", title: "From JSON", section: "Backend", checkpoint: "General", targetFiles: [], dependencies: [], parallel: false, inferenceRules: [] }] },
    });
    assert.equal(r.source, "tasksJson");
    assert.ok(r.hasTasksJson);
  });

  it("converts tasksJson to markdown v1 when content empty", () => {
    const r = resolveProjectTasksSsot({
      tasksContent: "",
      tasksJson: {
        tasks: [
          {
            id: "T-001",
            title: "Seed",
            section: "Backend",
            checkpoint: "General",
            targetFiles: [],
            dependencies: [],
            parallel: false,
            inferenceRules: [],
          },
        ],
      },
    });
    assert.equal(r.source, "tasksJson");
    assert.match(r.markdown ?? "", /T-001/);
  });
});
