import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDeliverableCascadeProgressUpdate,
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

  it("applyDeliverableCascadeProgressUpdate marks all completedSteps from one poll", () => {
    const rows: AgentProgressItem[] = [
      { agent: "Entregables", message: "⚪ Blueprint — Generando…", step: "Blueprint", status: "generando" },
      { agent: "Entregables", message: "⚪ Contratos API — Generando…", step: "Contratos API", status: "generando" },
      { agent: "Entregables", message: "⚪ Tareas — Generando…", step: "Tareas", status: "generando" },
    ];
    const completed = new Set<string>();
    const out = applyDeliverableCascadeProgressUpdate(rows, completed, {
      step: "tasks",
      completedSteps: ["blueprint", "api_contracts", "tasks"],
    });
    assert.equal(out.cascadeCompleted, 3);
    assert.equal(out.agentProgress[0]?.status, "terminado");
    assert.equal(out.agentProgress[1]?.status, "terminado");
    assert.equal(out.agentProgress[2]?.status, "terminado");
  });
});
