import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  inferAgentsFromQualityGaps,
  resolveCorrectionAgentsFromQualityGate,
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
});
