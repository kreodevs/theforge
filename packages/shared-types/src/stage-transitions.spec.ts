import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAllowedStageTransitions, transitionStageBodySchema } from "./stage.js";

describe("getAllowedStageTransitions", () => {
  it("DRAFT permite activar o archivar", () => {
    assert.deepEqual(getAllowedStageTransitions("DRAFT"), ["activate", "archive"]);
  });

  it("ACTIVE permite completar o archivar", () => {
    assert.deepEqual(getAllowedStageTransitions("ACTIVE"), ["complete", "archive"]);
  });

  it("ARCHIVED solo permite reabrir", () => {
    assert.deepEqual(getAllowedStageTransitions("ARCHIVED"), ["reopen"]);
  });
});

describe("transitionStageBodySchema", () => {
  it("rechaza acción desconocida", () => {
    const parsed = transitionStageBodySchema.safeParse({ action: "skip" });
    assert.equal(parsed.success, false);
  });

  it("acepta activate con reason opcional", () => {
    const parsed = transitionStageBodySchema.safeParse({ action: "activate", reason: "Retomar etapa" });
    assert.equal(parsed.success, true);
  });
});
