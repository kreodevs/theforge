import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkArchitectureVsMdd,
  checkTasksEntityMigrations,
  checkTasksBlueprintPhases,
  checkSchedulerConsistency,
  checkResearchGapsInTasks,
  collectSddPrecisionGaps,
  precisionGapsForPostPassRetry,
} from "./sdd-precision-checks.util.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__/ia-trading-gaps");
const mdd = readFileSync(join(FIX, "mdd-snippet.md"), "utf8");
const research = readFileSync(join(FIX, "research-snippet.md"), "utf8");
const blueprint = readFileSync(join(FIX, "blueprint-phases-snippet.md"), "utf8");

describe("sdd-precision-checks.util", () => {
  it("checkArchitectureVsMdd flags missing Alpha Engine module", () => {
    const arch = "# Arquitectura\n\nmodules/auth/\nmodules/recommendations/\n";
    const result = checkArchitectureVsMdd(mdd, arch);
    assert.equal(result.ok, false);
    assert.ok(result.gaps.some((g) => /Alpha Engine/i.test(g)));
  });

  it("checkTasksEntityMigrations flags missing signal_id migration", () => {
    const tasks =
      "- [ ] Implementar endpoint POST /api/v1/recommendations según contrato API\n";
    const result = checkTasksEntityMigrations(mdd, tasks);
    assert.equal(result.ok, false);
    assert.ok(result.gaps.some((g) => /signal_id/i.test(g)));
  });

  it("checkTasksBlueprintPhases flags missing phase sections", () => {
    const tasks = "## User Story: US-005 Generación de Recomendación\n- [ ] task\n";
    const result = checkTasksBlueprintPhases(blueprint, tasks);
    assert.equal(result.ok, false);
  });

  it("checkSchedulerConsistency detects CST vs UTC conflict", () => {
    const lf = "Scheduler 22:00 CST martes/jueves";
    const us = "cron 08:00 UTC lunes";
    const result = checkSchedulerConsistency(mdd, lf, us);
    assert.equal(result.ok, false);
  });

  it("checkResearchGapsInTasks flags uncovered open gap", () => {
    const tasks = "- [ ] Crear auth module\n";
    const result = checkResearchGapsInTasks(research, tasks, mdd);
    assert.equal(result.ok, false);
  });

  it("collectSddPrecisionGaps and precisionGapsForPostPassRetry", () => {
    const gaps = collectSddPrecisionGaps({
      mdd,
      architecture: "# Arquitectura\n\nmodules/auth/\nmodules/recommendations/\n",
      blueprint,
      tasks: "- [ ] Implementar endpoint POST /api/v1/recommendations según contrato\n",
      logicFlows: "22:00 CST",
      userStories: "08:00 UTC lunes",
      phase0Summary: research,
    });
    assert.ok(gaps.length > 0);
    const flags = precisionGapsForPostPassRetry(gaps);
    assert.equal(flags.retryArchitecture, true);
    assert.equal(flags.retryLogicFlows, true);
    assert.ok(flags.retryTasks || flags.retryArchitecture);
  });
});
