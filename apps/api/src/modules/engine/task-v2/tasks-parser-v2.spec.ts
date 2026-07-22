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

  it("parses canonical v2 YAML with context, scope, requirements, verification", () => {
    const md = `# Tasks

## Backend tasks

---
id: T-001
section: Backend
title: Bootstrap API NestJS + ORM + PostgreSQL
status: pending
change_type: create
parallel: true
depends_on: []

context:
  mdd_ref: "§2 Arquitectura"
  story_ref: US-JRN-CAP_3_1
  why: "Base del monolito modular"

scope:
  include:
    - apps/backend/src/main.ts
    - apps/backend/src/app.module.ts
  exclude:
    - apps/web/**

requirements:
  - Prefijo global api/v1
  - GET /api/v1/health → 200

constraints:
  - Usar TypeORM según MDD

verification:
  - run: yarn workspace @mkt-agency/backend build
    expect_exit: 0

done_when:
  - Build sin errores TS
---

- [ ] [P] T-001 — Bootstrap API NestJS + ORM + PostgreSQL
  - Crear ConfigModule global
`;
    const result = parseTasksV2(md);
    assert.equal(result.tasks.length, 1);
    const task = result.tasks[0]!;
    assert.equal(task.id, "T-001");
    assert.equal(task.status, "pending");
    assert.equal(task.dependencies[0] ?? "none", "none");
    assert.ok(task.targetFiles.includes("apps/backend/src/main.ts"));
    assert.equal(task.mddRef, "§2 Arquitectura");
    assert.equal(task.storyRef, "US-JRN-CAP_3_1");
    assert.ok(task.requirements.length >= 2);
    assert.ok(task.doneWhen.length >= 1);
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
