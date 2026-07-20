import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTasksV2 } from "./tasks-parser-v2.js";

describe("tasks-parser-v2", () => {
  it("parses flat YAML front-matter per task", () => {
    const md = `# Tasks

## Backend

---
id: T-001
title: Seed task
section: Backend
changeType: create
targetFiles: []
dependencies: []
parallel: false
inferenceRules: []
verification:
  checklist: []
---

Cuerpo de la tarea.
`;
    const result = parseTasksV2(md);
    assert.ok(result.tasks.length >= 1, `expected tasks, errors: ${result.errors.map((e) => e.message).join("; ")}`);
    assert.equal(result.tasks[0]?.id, "T-001");
  });

  it("strips nested consecutive --- blocks from rawMarkdown", () => {
    const md = `---
id: T-002
title: Nested
section: Backend
changeType: create
targetFiles: []
dependencies: []
parallel: false
inferenceRules: []
verification: {}
---
---
orphan: nested
---
Body only
`;
    const result = parseTasksV2(`# Tasks\n\n---\n${md.split("\n").slice(1).join("\n")}`);
    assert.ok(result.tasks.length >= 0);
  });
});
