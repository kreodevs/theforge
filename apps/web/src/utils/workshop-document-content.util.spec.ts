import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentMarkdown } from "@theforge/shared-types";
import {
  normalizeWorkshopDocumentForEditor,
  workshopDocumentBodiesEqual,
} from "./workshop-document-content.util.js";

const STAMP =
  "<!-- theforge-doc:created=2026-07-15T10:30:45.000Z|updated=2026-07-16T14:45:30.000Z -->\n" +
  "> 📅 Creado: 15 jul 2026, 10:30:45 UTC · Última regeneración: 16 jul 2026, 14:45:30 UTC\n\n" +
  "---\n\n";

describe("workshop-document-content", () => {
  it("normalize strips stamp and applies formatDocumentMarkdown", () => {
    const body = "# Domain Benchmark\n\nContenido.";
    const out = normalizeWorkshopDocumentForEditor(STAMP + body);
    assert.equal(out, formatDocumentMarkdown(body));
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

  it("MDD editor strips stamp like other deliverables", () => {
    const body = "# Master Design Document\n\n## 1. Contexto\n";
    const out = normalizeWorkshopDocumentForEditor(STAMP + body);
    assert.equal(out?.trim(), body.trim());
    assert.doesNotMatch(out ?? "", /📅/);
  });

  it("strips corrupted stamp glued before H1 (no false dirty / upstream sync)", () => {
    const corrupted =
      "Última modificación: 2026-07-18T05:06:06.701Z --> 📅 Creado: 18 de julio de 2026, 05:06:06 UTC · Última modificación: 18 de julio de 2026, 05:06:06 UTC --- # Master Design Document\n\n## 1. Contexto\n";
    const body = "# Master Design Document\n\n## 1. Contexto\n";
    const out = normalizeWorkshopDocumentForEditor(corrupted);
    assert.equal(out?.trim(), body.trim());
    assert.doesNotMatch(out ?? "", /📅|Última modificación:/);
  });
});

describe("buildWorkshopDocumentTimestampsMap", () => {
  it("extrae fechas de campos con stamp antes de normalizar editor", async () => {
    const { buildWorkshopDocumentTimestampsMap } = await import(
      "./workshop-document-content.util.js"
    );
    const body = "# MDD\n\nContenido.";
    const stamped = STAMP + body;
    const map = buildWorkshopDocumentTimestampsMap(
      { mddContent: stamped, dbgaContent: stamped, stages: [] },
      null,
    );
    assert.ok(map.mddContent?.created.includes("2026"));
    assert.ok(map.dbgaContent?.updated.includes("2026"));
    assert.notEqual(map.mddContent?.created, map.mddContent?.updated);
  });
});
