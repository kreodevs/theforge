import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMddJobProgress,
  createEmptyMddJobProgressState,
  normalizeMddJobProgressState,
} from "./mdd-job-progress.js";

describe("mdd-job-progress", () => {
  it("accumulates completed steps and clears active on done", () => {
    let state = createEmptyMddJobProgressState();
    state = applyMddJobProgress(state, {
      agent: "Arquitecto de Software",
      message: "Definiendo schema SQL y contratos de API…",
      phase: "active",
    });
    assert.equal(state.active?.agent, "Arquitecto de Software");
    assert.equal(state.steps.length, 0);

    state = applyMddJobProgress(state, {
      agent: "Arquitecto de Software",
      message: "Schema SQL y contratos de API definidos",
      phase: "done",
    });
    assert.equal(state.active, null);
    assert.equal(state.steps.length, 1);
  });

  it("deduplicates consecutive identical completed steps", () => {
    let state = createEmptyMddJobProgressState();
    state = applyMddJobProgress(state, {
      agent: "Inyector de diagramas (MDD)",
      message: "Diagramas Mermaid añadidos",
      phase: "done",
    });
    state = applyMddJobProgress(state, {
      agent: "Inyector de diagramas (MDD)",
      message: "Diagramas Mermaid añadidos",
      phase: "done",
    });
    assert.equal(state.steps.length, 1);
  });

  it("normalizes legacy flat progress patch", () => {
    const state = normalizeMddJobProgressState({
      agent: "Auditor (calidad MDD)",
      message: "Calidad del MDD evaluada",
    });
    assert.equal(state.steps.length, 1);
    assert.equal(state.active, null);
  });
});
