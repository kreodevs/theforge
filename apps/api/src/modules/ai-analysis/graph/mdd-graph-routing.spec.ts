import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildQualityGateCorrectionState,
  expandCorrectionSectionsToRun,
  resolveCorrectionAgentsFromQualityGate,
} from "../utils/mdd-manager-routing.util.js";

describe("mdd-graph quality gate correction routing", () => {
  it("§5 gap routes to architect-only sectionsToRun", () => {
    const agents = resolveCorrectionAgentsFromQualityGate({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 5", issue: "Sin lógica", fix: "Añadir edge cases" }],
    });
    assert.deepEqual(agents, ["software_architect"]);
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 5", issue: "Sin lógica", fix: "Añadir edge cases" }],
    });
    assert.equal(state.delegateTarget, "sections");
    assert.deepEqual(state.sectionsToRun, expandCorrectionSectionsToRun(["software_architect"]));
  });

  it("max correction path excludes full sec/int when only §3 fails", () => {
    const agents = resolveCorrectionAgentsFromQualityGate({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 3", issue: "SQL incompleto", fix: "Completar FK" }],
    });
    const sections = expandCorrectionSectionsToRun(agents);
    assert.deepEqual(sections.slice(0, 1), ["software_architect"]);
    assert.ok(!sections.includes("security"));
    assert.ok(!sections.includes("integration"));
  });
});
