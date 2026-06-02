import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRD_SECTION_OUTLINE,
  buildBrdUserPrompt,
} from "./brd-generation-prompt.js";

describe("buildBrdUserPrompt", () => {
  it("incluye plantilla operativa y delimitadores", () => {
    const prompt = buildBrdUserPrompt({
      mode: "greenfield-from-dbga",
      sourceLabel: "DBGA",
      sourceDocument: "# Benchmark\n",
    });
    assert.match(prompt, /<<<BRD>>>/);
    assert.match(prompt, /Matriz de permisos/);
    assert.match(prompt, /Requisitos no funcionales/);
    assert.match(prompt, /Contratos de datos/);
    assert.match(prompt, /Pendientes de validación/);
    assert.match(prompt, /--- DBGA ---/);
  });

  it("modo legacy-change incluye baseline", () => {
    const prompt = buildBrdUserPrompt({
      mode: "legacy-change",
      sourceLabel: "DOCUMENTO",
      sourceDocument: "doc",
      baselineBrdBlock: "## Línea base\n",
    });
    assert.match(prompt, /BRD de cambio/);
    assert.match(prompt, /## Línea base/);
  });
});

describe("BRD_SECTION_OUTLINE", () => {
  it("cubre flujos de autorización y UX transversal", () => {
    assert.match(BRD_SECTION_OUTLINE, /Flujos de negocio críticos/);
    assert.match(BRD_SECTION_OUTLINE, /Requisitos UX\/UI transversales/);
  });
});
