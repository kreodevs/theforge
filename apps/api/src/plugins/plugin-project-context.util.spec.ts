import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProjectDeliverablesContext,
  buildProjectHookContext,
  pickPrimaryStageForHooks,
  projectMeetsArtifactRequirements,
} from "./plugin-project-context.util.js";

describe("plugin-project-context.util", () => {
  it("buildProjectDeliverablesContext mapea campos core", () => {
    const ctx = buildProjectDeliverablesContext({
      mddContent: "# MDD",
      specContent: "# Spec",
      dbgaContent: null,
      phase0SummaryContent: null,
      architectureContent: null,
      useCasesContent: null,
      userStoriesContent: null,
      blueprintContent: null,
      uxUiGuideContent: null,
      apiContractsContent: null,
      logicFlowsContent: null,
      tasksContent: null,
      infraContent: null,
      agentGovernanceContent: null,
      aemContent: null,
      uiScreensContent: null,
      brdContent: null,
    });
    assert.equal(ctx.mddContent, "# MDD");
    assert.equal(ctx.specContent, "# Spec");
  });

  it("pickPrimaryStageForHooks prefiere ACTIVE de menor ordinal", () => {
    const stages = [
      { ordinal: 2, workflowStatus: "ACTIVE", mddContent: "m2" },
      { ordinal: 1, workflowStatus: "ACTIVE", mddContent: "m1" },
      { ordinal: 0, workflowStatus: "DRAFT", mddContent: "m0" },
    ];
    const primary = pickPrimaryStageForHooks(stages);
    assert.equal(primary?.ordinal, 1);
    assert.equal(primary?.mddContent, "m1");
  });

  it("buildProjectHookContext aplica overlay MDD/BRD", () => {
    const ctx = buildProjectHookContext(
      { specContent: "# Spec", dbgaContent: "# DBGA" },
      { mddContent: "# MDD", brdContent: "# BRD" },
    );
    assert.equal(ctx.mddContent, "# MDD");
    assert.equal(ctx.brdContent, "# BRD");
    assert.equal(ctx.specContent, "# Spec");
  });

  it("projectMeetsArtifactRequirements detecta faltantes", () => {
    const ok = projectMeetsArtifactRequirements({ specContent: "x" }, ["specContent"]);
    assert.equal(ok.ok, true);
    const bad = projectMeetsArtifactRequirements({ specContent: "" }, ["specContent", "mddContent"]);
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.deepEqual(bad.missing, ["specContent", "mddContent"]);
    }
  });
});
