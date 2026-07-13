import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_STAGE_TOOL_NAMES,
  PROJECT_STAGE_TOOLS,
  createProjectStageHandlers,
} from "./project-stage-tools.js";

describe("project stage MCP tools", () => {
  test("cada tool definida tiene handler", () => {
    const handlers = createProjectStageHandlers({
      get: async () => ({}),
      post: async () => ({}),
      patch: async () => ({}),
    });
    for (const name of PROJECT_STAGE_TOOL_NAMES) {
      assert.ok(typeof handlers[name] === "function", `Falta handler para ${name}`);
    }
  });

  test("patch_project_stage exige al menos un campo", async () => {
    const handlers = createProjectStageHandlers({
      get: async () => ({}),
      post: async () => ({}),
      patch: async () => {
        throw new Error("no debería llamar API");
      },
    });
    await assert.rejects(
      () =>
        handlers.patch_project_stage!({
          projectId: "00000000-0000-4000-8000-000000000001",
          stageId: "00000000-0000-4000-8000-000000000002",
        }),
      /al menos un campo/,
    );
  });

  test("transition_project_stage valida action", async () => {
    const handlers = createProjectStageHandlers({
      get: async () => ({}),
      post: async () => {
        throw new Error("no debería llamar API");
      },
      patch: async () => ({}),
    });
    await assert.rejects(
      () =>
        handlers.transition_project_stage!({
          projectId: "00000000-0000-4000-8000-000000000001",
          stageId: "00000000-0000-4000-8000-000000000002",
          action: "skip",
        }),
      /Invalid enum value|action/i,
    );
  });

  test("PROJECT_STAGE_TOOLS tiene 4 herramientas", () => {
    assert.equal(PROJECT_STAGE_TOOLS.length, 4);
  });
});
