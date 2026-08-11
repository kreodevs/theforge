import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPhase0BorradorJson,
  shouldReplacePhase0SummaryWithBorrador,
} from "./phase0-content.js";
import {
  mergePhase0SummaryPreservePaso0Sidecar,
  PASO0_PASTE_SIDECAR_KIND,
  serializePaso0PasteSidecar,
} from "./paso0-decision-catalog.js";

describe("phase0-content", () => {
  it("detecta borrador JSON", () => {
    assert.equal(
      isPhase0BorradorJson('{"proposito":{"problema":"x","usuarios":[],"outOfScope":[]},"entidades":[]}'),
      true,
    );
    assert.equal(isPhase0BorradorJson("# Benchmark\n\n## Gap"), false);
    assert.equal(isPhase0BorradorJson('{"foo":1}'), false);
  });

  it("no pisa Deep Research markdown al actualizar borrador", () => {
    assert.equal(shouldReplacePhase0SummaryWithBorrador(""), true);
    assert.equal(shouldReplacePhase0SummaryWithBorrador(null), true);
    assert.equal(
      shouldReplacePhase0SummaryWithBorrador('{"proposito":{"problema":"a","usuarios":[],"outOfScope":[]}}'),
      true,
    );
    assert.equal(
      shouldReplacePhase0SummaryWithBorrador("# Deep Research\n\n## Competidores"),
      false,
    );
  });

  it("preserva sidecar paso0 al guardar Deep Research", () => {
    const sidecar = serializePaso0PasteSidecar({
      envelopeKind: PASO0_PASTE_SIDECAR_KIND,
      version: 1,
      catalog: {
        kind: "paso0_decision_catalog",
        version: 1,
        extractedAt: new Date().toISOString(),
        sourceHash: "abc",
        decisions: [{ id: "D-002", rule: "Nucleo contextual" }],
        mvpCapabilities: [],
        outOfScope: [],
        entities: [{ term: "Contexto", definition: "Entidad de negocio" }],
        invariants: [],
        risks: [],
      },
    });
    const merged = mergePhase0SummaryPreservePaso0Sidecar(
      sidecar,
      "# Especificador de Base para MDD\n\n## Gap analysis",
    );
    assert.match(merged, /paso0_paste_sidecar/);
    assert.match(merged, /deepResearchMarkdown/);
    assert.match(merged, /Especificador de Base/);
    assert.doesNotMatch(merged, /^# Especificador/m);
  });
});
