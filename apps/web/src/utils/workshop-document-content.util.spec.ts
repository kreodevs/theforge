import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWorkshopDocumentForEditor,
  workshopDocumentBodiesEqual,
} from "./workshop-document-content.util.js";

const STAMP =
  "<!-- theforge-doc:created=2026-07-15T10:30:45.000Z|updated=2026-07-16T14:45:30.000Z -->\n" +
  "> 📅 Creado: 15 jul 2026, 10:30:45 UTC · Última regeneración: 16 jul 2026, 14:45:30 UTC\n\n" +
  "---\n\n";

describe("workshop-document-content", () => {
  it("normalize strips stamp and keeps body", () => {
    const body = "# Domain Benchmark\n\nContenido.";
    const out = normalizeWorkshopDocumentForEditor(STAMP + body);
    assert.equal(out, body);
  });

  it("bodies equal when only stamp timestamps differ", () => {
    const body = "# DBGA\n\nMismo cuerpo.";
    const a = STAMP + body;
    const b =
      "<!-- theforge-doc:created=2026-07-15T10:30:45.000Z|updated=2026-07-16T99:99:99.000Z -->\n" +
      "> 📅 Creado: 15 jul 2026 · Última regeneración: otro\n\n---\n\n" +
      body;
    assert.equal(workshopDocumentBodiesEqual(a, b), true);
  });

  it("bodies not equal when document body differs", () => {
    assert.equal(
      workshopDocumentBodiesEqual(STAMP + "# A\n", STAMP + "# B\n"),
      false,
    );
  });

  it("local editor text equals stamped server baseline", () => {
    const body = "# Fase 0\n\nTexto.";
    assert.equal(workshopDocumentBodiesEqual(body, STAMP + body), true);
  });
});
