import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDeliverableCascadeStepDone,
  readDeliverableCascadeProgressStep,
  resolveDeliverableCascadeStepLabel,
} from "./deliverableCascadeProgress.js";
import type { AgentProgressItem } from "./agentProgress.js";

describe("deliverableCascadeProgress", () => {
  it("maps DeliverableKind slugs to Workshop labels", () => {
    assert.equal(resolveDeliverableCascadeStepLabel("spec"), "Spec");
    assert.equal(resolveDeliverableCascadeStepLabel("architecture"), "Arquitectura");
  });

  it("ignores preflight and done", () => {
    assert.equal(readDeliverableCascadeProgressStep({ step: "preflight" }), "preflight");
    assert.equal(resolveDeliverableCascadeStepLabel("preflight"), null);
    assert.equal(resolveDeliverableCascadeStepLabel("done"), null);
  });

  it("applyDeliverableCascadeStepDone marks matching row without counting preflight", () => {
    const rows: AgentProgressItem[] = [
      { agent: "Entregables", message: "⚪ Blueprint — Generando…", step: "Blueprint", status: "generando" },
      { agent: "Entregables", message: "⚪ Spec — Generando…", step: "Spec", status: "generando" },
    ];
    const completed = new Set<string>();

    const preflight = applyDeliverableCascadeStepDone(rows, completed, "preflight");
    assert.equal(preflight.cascadeCompleted, 0);
    assert.equal(preflight.matched, false);
    assert.equal(preflight.agentProgress[0]?.status, "generando");

    const spec = applyDeliverableCascadeStepDone(preflight.agentProgress, completed, "spec");
    assert.equal(spec.cascadeCompleted, 1);
    assert.equal(spec.matched, true);
    assert.equal(spec.agentProgress[1]?.status, "terminado");
    assert.match(spec.agentProgress[1]?.message ?? "", /✅ Spec — Terminado/);
  });
});
