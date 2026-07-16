import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferAgentsFromQualityGaps,
  resolveCorrectionAgentsFromQualityGate,
  expandCorrectionSectionsToRun,
  buildQualityGateCorrectionState,
} from "./mdd-manager-routing.util.js";

describe("mdd-manager-routing (quality gate)", () => {
  it("maps §6 security gap to security agent", () => {
    const agents = inferAgentsFromQualityGaps([
      { section: "Sección 6", issue: "Falta MFA", fix: "Añadir TOTP en §6" },
    ]);
    assert.deepEqual(agents, ["security"]);
  });

  it("maps §3 SQL gap to software_architect", () => {
    const agents = inferAgentsFromQualityGaps([
      { section: "Sección 3", issue: "CREATE TABLE incompleto", fix: "Completar FK" },
    ]);
    assert.deepEqual(agents, ["software_architect"]);
  });

  it("resolveCorrectionAgentsFromQualityGate prefers gaps over blockers", () => {
    const agents = resolveCorrectionAgentsFromQualityGate({
      ok: false,
      blockers: ["Falta TechnicalMetadata"],
      warnings: [],
      gaps: [{ section: "Sección 7", issue: "Sin manifest", fix: "Añadir docker-compose" }],
    });
    assert.deepEqual(agents, ["integration"]);
  });

  it("resolveCorrectionAgentsFromQualityGate falls back to blockers text", () => {
    const agents = resolveCorrectionAgentsFromQualityGate(
      {
        ok: false,
        blockers: ["Sección 4: contratos API incompletos"],
        warnings: [],
        gaps: [],
      },
      (fb) => (/\bapi\b/i.test(fb) ? ["software_architect"] : ["clarifier"]),
    );
    assert.deepEqual(agents, ["software_architect"]);
  });

  it("expandCorrectionSectionsToRun omits security/integration for §5-only gap", () => {
    const sections = expandCorrectionSectionsToRun(["software_architect"]);
    assert.deepEqual(sections, [
      "software_architect",
      "formatter",
      "diagram_injector",
      "quality_gate",
    ]);
    assert.ok(!sections.includes("security"));
    assert.ok(!sections.includes("integration"));
  });

  it("buildQualityGateCorrectionState routes §6 gap to security only", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 6", issue: "Sin MFA", fix: "Añadir TOTP" }],
    });
    assert.equal(state.delegateTarget, "sections");
    assert.deepEqual(state.sectionsToRun, [
      "security",
      "formatter",
      "diagram_injector",
      "quality_gate",
    ]);
  });
});
