import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildChangePlanFromProject } from "./change-plan-extract.util.js";

describe("buildChangePlanFromProject", () => {
  it("extracts files and symbols from tasks markdown", () => {
    const plan = buildChangePlanFromProject({
      theforgeProjectId: "proj-uuid",
      tasksContent: [
        "## Backend",
        "- [ ] T-001 Add discount field",
        "  **Archivo:** src/components/ClientForm.tsx",
        "  **Función:** ClientForm",
      ].join("\n"),
      legacyChangeState: {
        description: "Add discount",
        filesToModify: [{ path: "src/components/ClientForm.tsx", repoId: "r1" }],
      },
    });
    assert.ok(plan);
    assert.equal(plan!.files.length, 1);
    assert.equal(plan!.files[0]!.path, "src/components/ClientForm.tsx");
    assert.equal(plan!.referencePlan?.filesToModify.length, 1);
  });

  it("returns null without files", () => {
    const plan = buildChangePlanFromProject({
      theforgeProjectId: "p1",
      tasksContent: "## Empty\nNo tasks yet.",
    });
    assert.equal(plan, null);
  });
});
