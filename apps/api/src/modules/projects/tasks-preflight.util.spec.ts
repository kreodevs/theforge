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

  it("strict DocAccuracy penaliza uiScreens solo con hasUxTeam", async () => {
    const specWithEmptyHeadings = `# Spec\n\n## 1.\n\n**Journey:** flujo.\n\n${"z".repeat(120)}`;
    const uiScreens = "# Pantallas\n\n" + "| /dashboard | Page | — | Table | GET /api/v1/health | ok |\n".repeat(20) + "x".repeat(800);

    const withoutUiUxTeam = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: specWithEmptyHeadings,
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
      uiScreensMarkdown: "",
      hasUxTeam: true,
    });
    const withUi = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: specWithEmptyHeadings,
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
      uiScreensMarkdown: uiScreens,
      hasUxTeam: true,
    });
    const noUxTeam = await runTasksPreflightStrict({
      mddMarkdown: substantiveMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: specWithEmptyHeadings,
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
      uiScreensMarkdown: "",
      hasUxTeam: false,
    });

    const uxTeamGap = withoutUiUxTeam.blockers.find((b) => b.includes("DocAccuracy"));
    const withUiGap = withUi.blockers.find((b) => b.includes("DocAccuracy"));
    const noUxGap = noUxTeam.blockers.find((b) => b.includes("DocAccuracy"));

    assert.ok(uxTeamGap?.includes("uiScreens") || withoutUiUxTeam.warnings.some((w) => w.includes("uiScreens")));
    assert.ok(!withUiGap?.includes("uiScreens ausente"));
    assert.ok(!noUxGap?.includes("uiScreens ausente"));
  });

  it("acknowledgeGaps convierte gate MDD en warning", async () => {
    const thinMdd =
      "## 1. Contexto\n\n" +
      "x".repeat(220) +
      "\n## 2. Stack\n\nx\n## 3. Datos\n\nusers\n## 4. API\n\nGET /health\n## 5. Lógica\n\nx\n## 6. Seguridad\n\nx\n## 7. Infra\n\nx";
    const r = await runTasksPreflightStrict({
      mddMarkdown: thinMdd,
      blueprintMarkdown: substantiveBlueprint,
      specMarkdown: substantiveSpec,
      apiContractsMarkdown: "# API\n\n" + "a".repeat(120),
      acknowledgeGaps: true,
    });
    assert.ok(
      !r.blockers.some((b) => b.includes("MDD delivery gate")) ||
        r.warnings.some((w) => w.includes("MDD delivery gate")),
    );
  });
});
