import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTasksCoverageChecklist,
  endpointCoveredInTasks,
  formatTasksCoverageChecklistGaps,
  pantallaRouteCoveredInTasks,
} from "./tasks-coverage-checklist.util.js";

describe("tasks-coverage-checklist", () => {
  it("detecta endpoints sin task Backend", () => {
    const api = [
      "| GET | `/api/v1/tenants` | list | JWT |",
      "| POST | `/api/v1/tenants` | create | JWT |",
    ].join("\n");
    const tasks = [
      "# Tasks",
      "## Backend tasks",
      "---",
      "id: T-001",
      "section: Backend",
      "title: List tenants",
      "target_files: [a.ts]",
      "change_type: create",
      "---",
      "- [ ] GET /api/v1/tenants",
      "## Infra tasks",
      "---",
      "id: T-002",
      "section: Infra",
      "title: Docker",
      "target_files: [docker-compose.yml]",
      "change_type: configure",
      "---",
      "- [ ] infra",
    ].join("\n");

    const checklist = buildTasksCoverageChecklist({
      tasksMarkdown: tasks,
      apiContractsMarkdown: api,
      mddMarkdown: "## 1. Contexto\nApp",
    });
    assert.ok(checklist.missingEndpoints.includes("POST /api/v1/tenants"));
    assert.equal(endpointCoveredInTasks(tasks, "GET", "/api/v1/tenants"), true);
    const gaps = formatTasksCoverageChecklistGaps(checklist);
    assert.ok(gaps.some((g) => /POST \/api\/v1\/tenants/.test(g)));
  });

  it("detecta rutas de pantallas sin task Frontend", () => {
    const ui = "| /dashboard | Dash | US-1 | Table | GET /api/v1/tenants | ok |";
    const tasks = [
      "# Tasks",
      "## Backend tasks",
      "---",
      "id: T-001",
      "section: Backend",
      "title: API",
      "target_files: [a.ts]",
      "change_type: create",
      "---",
      "- [ ] task",
      "## Infra tasks",
      "---",
      "id: T-002",
      "section: Infra",
      "title: Docker",
      "target_files: [docker-compose.yml]",
      "change_type: configure",
      "---",
      "- [ ] infra",
    ].join("\n");

    assert.equal(pantallaRouteCoveredInTasks(tasks, "/dashboard"), false);
    const checklist = buildTasksCoverageChecklist({
      tasksMarkdown: tasks,
      uiScreensMarkdown: ui,
      mddMarkdown: "## 1. Contexto\nApp",
    });
    assert.deepEqual(checklist.missingRoutes, ["/dashboard"]);
  });
});
