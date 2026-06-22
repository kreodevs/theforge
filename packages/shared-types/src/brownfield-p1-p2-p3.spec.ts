import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkBrdObjectiveMentionHealth } from "./brd-health.util.js";
import { buildStageChangeSpecContent } from "./stage-change-spec.util.js";
import {
  buildHandoffMicroSpecFiles,
  buildOpenSpecChangeExport,
} from "./openspec-export.util.js";
import {
  isLegacyIntegrationHandoffGatePending,
} from "./legacy-change-gate.js";

describe("checkBrdObjectiveMentionHealth", () => {
  it("returns ok when BRD or MDD missing", () => {
    assert.deepEqual(checkBrdObjectiveMentionHealth(null, "# MDD"), { ok: true, warnings: [] });
  });

  it("warns when objectives not reflected in MDD", () => {
    const brd = "## Objetivos\n\n- Reducir tiempo de checkout en ecommerce";
    const mdd = "## 1. Contexto\n\nSistema de facturación interna.";
    const r = checkBrdObjectiveMentionHealth(brd, mdd);
    assert.equal(r.ok, false);
    assert.ok(r.warnings.length > 0);
  });
});

describe("buildStageChangeSpecContent", () => {
  it("returns null for stage 1", () => {
    assert.equal(buildStageChangeSpecContent({ stageOrdinal: 1 }), null);
  });

  it("includes handoff items for stage 2+", () => {
    const md = buildStageChangeSpecContent({
      stageOrdinal: 2,
      stageName: "Integración",
      legacyChangeDescription: "Add discounts",
      handoffItems: [
        {
          id: "NEW-LEG-01",
          title: "Discount API",
          description: "Expose discount endpoint",
          status: "sent",
        },
      ],
    });
    assert.ok(md?.includes("NEW-LEG-01"));
    assert.ok(md?.includes("Add discounts"));
  });
});

describe("buildOpenSpecChangeExport", () => {
  it("creates openspec folder files", () => {
    const files = buildOpenSpecChangeExport({
      stageOrdinal: 2,
      projectName: "My Legacy App",
      legacyChangeDescription: "Discount module",
    });
    assert.ok(files.some((f) => f.path.endsWith("proposal.md")));
    assert.ok(files.some((f) => f.path.endsWith("tasks.md")));
    assert.ok(files.some((f) => f.path.includes("BRANCH-POLICY")));
  });
});

describe("buildHandoffMicroSpecFiles", () => {
  it("creates one file per handoff item", () => {
    const files = buildHandoffMicroSpecFiles([
      {
        id: "NEW-LEG-01",
        title: "Foo",
        description: "Bar",
        status: "sent",
        acceptanceCriteria: ["Must work"],
      },
    ]);
    assert.equal(files.length, 1);
    assert.ok(files[0].path.includes("new-leg-01"));
  });
});

describe("isLegacyIntegrationHandoffGatePending", () => {
  it("pending when strict gate and linked NEW without import", () => {
    assert.equal(
      isLegacyIntegrationHandoffGatePending({
        ordinal: 2,
        linkedNewProjectId: "np-1",
        enforceHandoffGate: true,
      }),
      true,
    );
  });

  it("not pending when handoff imported", () => {
    assert.equal(
      isLegacyIntegrationHandoffGatePending({
        ordinal: 2,
        linkedNewProjectId: "np-1",
        handoffImportedAt: new Date().toISOString(),
        enforceHandoffGate: true,
      }),
      false,
    );
  });
});
