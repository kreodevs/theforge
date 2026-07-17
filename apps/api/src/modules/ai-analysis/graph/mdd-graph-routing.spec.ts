import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildQualityGateCorrectionState,
  expandCorrectionSectionsToRun,
  resolveCorrectionAgentsFromQualityGate,
} from "../utils/mdd-manager-routing.util.js";
import {
  LEAN_ROUTE_RESOLVERS,
  resolveCorrectionHop,
  routeAfterIntegrationLean,
  routeAfterSecurityLean,
  routeAfterSoftwareArchitectLean,
} from "./mdd-graph-routing.util.js";

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

const NODE_ROUTE_RESOLVER: Record<string, string> = {
  software_architect: "routeAfterSoftwareArchitect",
  formatter: "routeAfterFormatterPreSecInt",
  security: "routeAfterSecurity",
  integration: "routeAfterIntegration",
  format_sec_int: "routeAfterFormatSecInt",
  diagram_injector: "routeAfterDiagram",
};

function assertCorrectionChainRoutable(sectionsToRun: string[]): void {
  for (let i = 0; i < sectionsToRun.length - 1; i++) {
    const current = sectionsToRun[i]!;
    const hop = sectionsToRun[i + 1]!;
    assert.ok(
      LEAN_GRAPH_CORRECTION_TARGETS.has(hop),
      `hop ${current} → ${hop} must be a lean graph node`,
    );
    const routerName = NODE_ROUTE_RESOLVER[current];
    const resolver = routerName
      ? LEAN_ROUTE_RESOLVERS.find((r) => r.router === routerName)
      : undefined;
    if (resolver) {
      assert.equal(resolveCorrectionHop(sectionsToRun, current, resolver), hop);
    }
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
    assert.ok(!state.sectionsToRun?.includes("software_architect"));
    assertCorrectionChainRoutable(state.sectionsToRun ?? []);
  });

  it("§6+§7 correction uses fanout_sec_int and excludes software_architect", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: [],
      warnings: [],
      gaps: [
        { section: "Sección 6", issue: "Sin RBAC", fix: "Añadir roles" },
        { section: "Sección 7", issue: "Sin CI", fix: "Añadir pipeline" },
      ],
    });
    assert.deepEqual(state.sectionsToRun?.slice(0, 2), ["fanout_sec_int", "format_sec_int"]);
    assert.ok(!state.sectionsToRun?.includes("software_architect"));
    assert.ok(state.sectionsToRun?.includes("diagram_injector"));
  });

  it("manifest §7 blocker correction chain is routable via fanout", () => {
    const state = buildQualityGateCorrectionState({
      ok: false,
      blockers: ['Manifest §7: hashing_algorithm "bcrypt" incoherente con Argon2id en §6.'],
      warnings: [],
      gaps: [],
    });
    assert.deepEqual(state.sectionsToRun?.[0], "fanout_sec_int");
    assert.ok(!state.sectionsToRun?.includes("software_architect"));
  });

  it("architect+security correction chain has routable hops (no null destination)", () => {
    const sections = expandCorrectionSectionsToRun(["software_architect", "security"]);
    assert.deepEqual(sections.slice(0, 2), ["software_architect", "security"]);
    assertCorrectionChainRoutable(sections);
  });

  it("full correction path routes integration to formatter (not null)", () => {
    const sections = expandCorrectionSectionsToRun([
      "software_architect",
      "security",
      "integration",
    ]);
    assert.deepEqual(sections, [
      "software_architect",
      "security",
      "integration",
      "formatter",
      "diagram_injector",
      "quality_gate",
    ]);
    const state = {
      delegateTarget: "sections" as const,
      sectionsToRun: sections,
      mddDraft: "# MDD",
      architectSection5PassPending: true,
    };
    assert.equal(routeAfterSoftwareArchitectLean(state), "security");
    assert.equal(routeAfterSecurityLean(state), "integration");
    assert.equal(routeAfterIntegrationLean(state), "formatter");
    assertCorrectionChainRoutable(sections);
  });

  it("integration without sectionsToRun falls back to format_sec_int", () => {
    const state = { mddDraft: "# MDD" };
    assert.equal(routeAfterIntegrationLean(state), "format_sec_int");
  });
});
