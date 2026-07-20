import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ComplexityLevel } from "@theforge/database";
import {
  buildSemaphoreBaseFromProject,
  mergeProjectFieldsForSemaphore,
} from "./project-mdd-persist.util.js";

describe("project-mdd-persist.util", () => {
  it("buildSemaphoreBaseFromProject defaults complexity to HIGH", () => {
    const base = buildSemaphoreBaseFromProject({
      complexity: null,
      hasUxTeam: false,
      figmaMapping: null,
      specContent: "spec",
      useCasesContent: null,
      userStoriesContent: null,
      tasksContent: null,
      apiContractsContent: null,
      uxUiGuideContent: null,
      logicFlowsContent: null,
      infraContent: null,
    });
    assert.equal(base.complexity, ComplexityLevel.HIGH);
    assert.equal(base.deliverables.specContent, "spec");
  });

  it("mergeProjectFieldsForSemaphore prefers PATCH fields over existing", () => {
    const merged = mergeProjectFieldsForSemaphore(
      {
        complexity: ComplexityLevel.LOW,
        hasUxTeam: false,
        figmaMapping: null,
        specContent: "old-spec",
        useCasesContent: null,
        userStoriesContent: null,
        tasksContent: null,
        apiContractsContent: null,
        uxUiGuideContent: null,
        logicFlowsContent: null,
        infraContent: "old-infra",
      } as Parameters<typeof mergeProjectFieldsForSemaphore>[0],
      { specContent: "new-spec" },
    );
    assert.equal(merged.specContent, "new-spec");
    assert.equal(merged.infraContent, "old-infra");
    assert.equal(merged.complexity, ComplexityLevel.LOW);
  });
});
