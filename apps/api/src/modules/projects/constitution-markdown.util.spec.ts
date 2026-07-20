import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ComplexityLevel, StageStatus } from "@theforge/database";
import {
  buildConstitutionMarkdown,
  pickMddFromStages,
} from "./constitution-markdown.util.js";

describe("constitution-markdown.util", () => {
  it("pickMddFromStages uses primary stage mddContent", () => {
    const mdd = pickMddFromStages([
      {
        id: "s1",
        ordinal: 1,
        workflowStatus: StageStatus.ACTIVE,
        mddContent: "# MDD",
      } as Parameters<typeof pickMddFromStages>[0][number],
    ]);
    assert.equal(mdd, "# MDD");
  });

  it("buildConstitutionMarkdown falls back to DBGA for LOW without MDD", () => {
    const md = buildConstitutionMarkdown({
      complexity: ComplexityLevel.LOW,
      dbgaContent: "DBGA body",
      phase0SummaryContent: null,
      specContent: null,
      stages: [],
    });
    assert.match(md, /DBGA body/);
  });
});
