import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runTasksPreflight, runTasksPreflightStrict } from "./tasks-preflight.util.js";

const substantiveMdd =
  "## 1. Contexto\n\n" + "x".repeat(300) + "\n## 2. Stack\n\nNestJS\n## 4. API\n\nREST";
const substantiveBlueprint = "# Blueprint\n\n" + "y".repeat(120);
const substantiveSpec = "# Spec\n\n" + "z".repeat(120);

describe("tasks-preflight", () => {
  it("blocks when MDD is too short", () => {
    const r = runTasksPreflight({ mddMarkdown: "corto" });
    assert.equal(r.ok, false);
    assert.ok(r.blockers.some((b) => b.includes("MDD")));
  });

  it("passes with substantive MDD", () => {
    const r = runTasksPreflight({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: substantiveSpec,
    });
    assert.equal(r.ok, true);
    assert.equal(r.blockers.length, 0);
  });

  it("strict blocks empty spec when not legacy baseline", async () => {
    const r = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: "",
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
    });
    assert.equal(r.ok, false);
    assert.ok(r.blockers.some((b) => b.includes("Spec vacío")));
  });

  it("strict legacy baseline relaxes spec and blueprint blockers", async () => {
    const r = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: "",
      specMarkdown: "",
      legacyBaselineStage: true,
    });
    assert.equal(r.ok, true);
    assert.ok(r.warnings.some((w) => w.includes("legacy baseline")));
  });

  it("strict blocks api-contracts when MDD has section 4 and not legacy", async () => {
    const r = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: substantiveSpec,
      apiContractsMarkdown: "",
      legacyBaselineStage: false,
    });
    assert.equal(r.ok, false);
    assert.ok(r.blockers.some((b) => b.includes("api-contracts")));
  });

  it("strict DocAccuracy includes uiScreens when provided", async () => {
    const specWithEmptyHeadings = `# Spec\n\n## 1.\n\n**Journey:** flujo.\n\n${"z".repeat(120)}`;
    const uiScreens = "# Pantallas\n\n" + "| /dashboard | Page | — | Table | GET /api/v1/health | ok |\n".repeat(20) + "x".repeat(800);

    const withoutUi = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: specWithEmptyHeadings,
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
      uiScreensMarkdown: "",
    });
    const withUi = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: specWithEmptyHeadings,
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
      uiScreensMarkdown: uiScreens,
    });

    const withoutGap = withoutUi.blockers.find((b) => b.includes("DocAccuracy"));
    const withGap = withUi.blockers.find((b) => b.includes("DocAccuracy"));
    assert.ok(withoutGap?.includes("uiScreens ausente"));
    assert.ok(!withGap?.includes("uiScreens ausente"));
  });
});
