import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGreenfieldCoverageChecklist,
  extractMddCoreServices,
  extractOpenResearchGaps,
  extractBlueprintPhases,
} from "./sdd-coverage-checklist.util.js";

const FIX = join(__dirname, "__fixtures__/ia-trading-gaps");
const mdd = readFileSync(join(FIX, "mdd-snippet.md"), "utf8");
const research = readFileSync(join(FIX, "research-snippet.md"), "utf8");
const blueprint = readFileSync(join(FIX, "blueprint-phases-snippet.md"), "utf8");

describe("sdd-coverage-checklist.util", () => {
  it("extracts core services from MDD §2", () => {
    const services = extractMddCoreServices(mdd);
    assert.ok(services.some((s) => /Alpha Engine/i.test(s)));
    assert.ok(services.some((s) => /Data Ingestion/i.test(s)));
  });

  it("extracts open gaps from research", () => {
    const gaps = extractOpenResearchGaps(research);
    assert.ok(gaps.some((g) => g.id.includes("alpha-signals")));
  });

  it("buildGreenfieldCoverageChecklist includes Alpha and signal_id for Tasks", () => {
    const checklist = buildGreenfieldCoverageChecklist({
      mddMarkdown: mdd,
      phase0Summary: research,
      blueprintMarkdown: blueprint,
      artifactLabel: "Tasks",
    });
    assert.match(checklist, /CHECKLIST DE COBERTURA OBLIGATORIA/);
    assert.match(checklist, /Alpha Engine/);
    assert.match(checklist, /signal_id/);
    assert.match(checklist, /Fase 4/);
    assert.match(checklist, /M7/);
  });

  it("extractBlueprintPhases parses numbered phases", () => {
    const phases = extractBlueprintPhases(blueprint);
    assert.ok(phases.length >= 3);
  });
});
