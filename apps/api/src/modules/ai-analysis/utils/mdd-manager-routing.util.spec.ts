import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockerToRoutableGap,
  collectQualityGateRoutableGaps,
  inferAgentsFromQualityGap,
  inferAgentsFromQualityGaps,
  inferPrimaryAgentFromGapSection,
  resolveCorrectionAgentsFromQualityGate,
  expandCorrectionSectionsToRun,
  buildQualityGateCorrectionState,
  resolveCorrectionRouting,
  qualityGapsTargetOnlySecInt,
} from "./mdd-manager-routing.util.js";

const SUBSTANTIAL_DRAFT = `# MDD
## 1. Contexto
Texto largo de contexto y alcance del sistema de autenticación empresarial.

## 2. Arquitectura
Stack Node 20, PostgreSQL, NestJS.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(64) NOT NULL
);
\`\`\`

## 4. Contratos API
| Método | Ruta | Descripción |
| GET | /api/v1/users | Listar |

## 5. Lógica
Dado usuario válido Cuando login Entonces JWT.

## 6. Seguridad
Argon2id para contraseñas locales.

## 7. Infraestructura
Manifest con docker-compose.
`;

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

  it("resolveCorrectionAgentsFromQualityGate merges gaps and blockers for routing", () => {
    const agents = resolveCorrectionAgentsFromQualityGate({
      ok: false,
      blockers: ["Falta TechnicalMetadata"],
      warnings: [],
      gaps: [{ section: "Sección 7", issue: "Sin manifest", fix: "Añadir docker-compose" }],
    });
    assert.deepEqual(agents, ["software_architect", "integration"]);
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
      "format_sec_int",
      "diagram_injector",
      "quality_gate",
    ]);
    assert.ok(!state.sectionsToRun?.includes("software_architect"));
  });

  it("§6 gap with endpoint in fix does not route to software_architect", () => {
    const agents = inferAgentsFromQualityGaps([
      {
        section: "Sección 6",
        issue: "Falta JWKS",
        fix: "Añadir endpoint GET /.well-known/jwks.json en §4",
      },
    ]);
    assert.deepEqual(agents, ["security"]);
  });

  it("§6+§7 gaps skip software_architect and use fanout", () => {
    const routing = resolveCorrectionRouting({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [
        { section: "Sección 6", issue: "Sin MFA", fix: "Añadir TOTP" },
        { section: "Sección 7", issue: "Sin docker-compose", fix: "Añadir manifest" },
      ],
    });
    assert.deepEqual(routing.agents, ["security", "integration"]);
    assert.deepEqual(routing.sectionsToRun.slice(0, 2), ["fanout_sec_int", "format_sec_int"]);
    assert.ok(!routing.sectionsToRun.includes("software_architect"));
    assert.equal(routing.architectSkipped, true);
  });

  it("§5-only gap enables section5 pass in correction state", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 5", issue: "Sin edge cases", fix: "Añadir reglas Dado/Cuando/Entonces" }],
    });
    assert.equal(state.architectSection5PassPending, true);
    assert.deepEqual(state.sectionsToRun?.slice(0, 1), ["software_architect"]);
  });

  it("inferPrimaryAgentFromGapSection prefers explicit section number", () => {
    assert.equal(inferPrimaryAgentFromGapSection("Sección 6"), "security");
    assert.equal(inferPrimaryAgentFromGapSection("§7 Infraestructura"), "integration");
    assert.equal(inferPrimaryAgentFromGapSection("General"), null);
  });

  it("qualityGapsTargetOnlySecInt is true for §6 and §7 only", () => {
    assert.equal(
      qualityGapsTargetOnlySecInt([
        { section: "Sección 6", issue: "x", fix: "y" },
        { section: "Sección 7", issue: "a", fix: "b" },
      ]),
      true,
    );
    assert.equal(
      qualityGapsTargetOnlySecInt([{ section: "Sección 3", issue: "SQL", fix: "FK" }]),
      false,
    );
  });

  it("job-12 style manifest §7 bcrypt blocker routes to security+integration without architect", () => {
    const blocker =
      'Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id documentado en §6.';
    const gap = blockerToRoutableGap(blocker);
    assert.equal(gap.section, "Sección 7");
    assert.deepEqual(inferAgentsFromQualityGap(gap), ["security", "integration"]);

    const routing = resolveCorrectionRouting({
      ok: false,
      blockers: [blocker],
      warnings: [],
      gaps: [],
    });
    assert.deepEqual(routing.agents, ["security", "integration"]);
    assert.ok(!routing.agents.includes("software_architect"));
    assert.ok(!routing.agents.includes("clarifier"));
    assert.equal(routing.architectSkipped, true);
    assert.deepEqual(routing.sectionsToRun[0], "fanout_sec_int");
  });

  it("merges blockers with gaps and keeps architect when §3 gap is substantive", () => {
    const items = collectQualityGateRoutableGaps({
      ok: false,
      blockers: ['Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id en §6.'],
      warnings: [],
      gaps: [{ section: "Sección 3", issue: "FK faltante", fix: "Añadir REFERENCES" }],
    });
    assert.equal(items.length, 2);
    const routing = resolveCorrectionRouting({
      ok: false,
      blockers: ['Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id en §6.'],
      warnings: [],
      gaps: [{ section: "Sección 3", issue: "FK faltante", fix: "Añadir REFERENCES" }],
    });
    assert.deepEqual(routing.agents, ["software_architect", "security", "integration"]);
    assert.equal(routing.architectSkipped, false);
  });

  it("mixed §3+§7 gaps skip architect when draft §2-§5 is substantial", () => {
    const routing = resolveCorrectionRouting(
      {
        ok: false,
        blockers: ['Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id en §6.'],
        warnings: [],
        gaps: [{ section: "Sección 3", issue: "FK menor", fix: "Revisar índice secundario" }],
      },
      undefined,
      { mddDraft: SUBSTANTIAL_DRAFT },
    );
    assert.deepEqual(routing.agents, ["security", "integration"]);
    assert.equal(routing.architectSkipped, true);
    assert.deepEqual(routing.sectionsToRun[0], "fanout_sec_int");
  });

  it("never routes clarifier unless gap is explicitly §1", () => {
    const routing = resolveCorrectionRouting({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [
        {
          section: "General",
          issue: "Alcance ambiguo en endpoints",
          fix: "Aclarar contratos API en §4",
        },
      ],
    });
    assert.ok(!routing.agents.includes("clarifier"));
  });

  it("routes clarifier_only when all gaps are §1", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [{ section: "Sección 1", issue: "Alcance vago", fix: "Definir stakeholders" }],
    });
    assert.equal(state.delegateTarget, "clarifier_only");
  });

  it("sets correctionArchitectSkipped when architect omitted for sec/int-only blockers", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: ['Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id en §6.'],
      warnings: [],
      gaps: [{ section: "General", issue: "Contexto OK", fix: "Sin cambios §1" }],
    });
    assert.equal(state.correctionArchitectSkipped, true);
    assert.deepEqual(state.sectionsToRun?.[0], "fanout_sec_int");
  });

  it("job-15 style unclosed ```sql fence blocker routes to formatter (not sec/int)", () => {
    const blocker =
      "Bloque ```sql sin cerrar: otro fence (```mermaid, ```TechnicalMetadata, etc.) antes del cierre.";
    const gap = blockerToRoutableGap(blocker);
    assert.equal(gap.section, "Sección 3");
    assert.deepEqual(inferAgentsFromQualityGap(gap), ["formatter"]);

    const routing = resolveCorrectionRouting({
      ok: false,
      blockers: [blocker],
      warnings: [],
      gaps: [],
    });
    assert.deepEqual(routing.agents, ["formatter"]);
    assert.ok(!routing.agents.includes("security"));
    assert.ok(!routing.agents.includes("integration"));
    assert.ok(!routing.agents.includes("software_architect"));
    assert.equal(routing.architectSkipped, true);
    assert.deepEqual(routing.sectionsToRun, [
      "formatter",
      "diagram_injector",
      "quality_gate",
    ]);
  });

  it("unclosed sql fence blocker with EOF variant routes to formatter", () => {
    const blocker = "Bloque ```sql sin cerrar con ``` antes del final del documento.";
    const agents = inferAgentsFromQualityGaps([blockerToRoutableGap(blocker)]);
    assert.deepEqual(agents, ["formatter"]);
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [blocker],
      warnings: [],
      gaps: [],
    });
    assert.deepEqual(state.sectionsToRun?.[0], "formatter");
    assert.ok(!state.sectionsToRun?.includes("fanout_sec_int"));
  });
});
