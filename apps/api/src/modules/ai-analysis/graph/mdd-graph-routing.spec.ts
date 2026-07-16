import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildQualityGateCorrectionState,
  expandCorrectionSectionsToRun,
  resolveCorrectionAgentsFromQualityGate,
} from "../utils/mdd-manager-routing.util.js";

/** Destinos válidos en createMddGraph tras corrección QG (sin nodo manager). */
const LEAN_GRAPH_CORRECTION_TARGETS = new Set([
  "clarifier",
  "software_architect",
  "architect_section5_prep",
  "formatter",
  "fanout_sec_int",
  "security",
  "integration",
  "format_sec_int",
  "diagram_injector",
  "quality_gate",
  "graph_populator",
]);

function assertCorrectionChainRoutable(sectionsToRun: string[]): void {
  for (let i = 0; i < sectionsToRun.length - 1; i++) {
    const hop = sectionsToRun[i + 1]!;
    assert.ok(
      LEAN_GRAPH_CORRECTION_TARGETS.has(hop),
      `hop ${sectionsToRun[i]} → ${hop} must be a lean graph node`,
    );
  }
}

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
    assertCorrectionChainRoutable(state.sectionsToRun ?? []);
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
    assertCorrectionChainRoutable(sections);
  });

  it("§6 correction chain routes through security without invalid hops", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 6", issue: "Sin MFA", fix: "Añadir TOTP" }],
    });
    assert.deepEqual(state.sectionsToRun?.[0], "security");
    assertCorrectionChainRoutable(state.sectionsToRun ?? []);
  });

  it("architect+security correction chain has routable hops (no null destination)", () => {
    const sections = expandCorrectionSectionsToRun(["software_architect", "security"]);
    assert.deepEqual(sections.slice(0, 2), ["software_architect", "security"]);
    assertCorrectionChainRoutable(sections);
  });
});
