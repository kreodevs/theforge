import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendDocumentChangelogEntry,
  bumpDocumentMinorVersion,
  bumpDocumentPatchVersion,
  documentBodyWithoutChangelog,
  ensureDocumentChangelog,
  fixDocumentChangelogInitialDate,
  formatDocumentChangelogDate,
  getDocumentChangelogLlmInstructions,
  hasDocumentChangelogSection,
  isChangelogOnlyDocument,
  parseLatestDocumentVersion,
} from "./document-changelog.js";

describe("document-changelog", () => {
  it("formatDocumentChangelogDate usa mes en español", () => {
    assert.equal(formatDocumentChangelogDate(new Date(2026, 4, 15)), "Mayo 2026");
  });

  it("ensureDocumentChangelog añade sección 1.0 si falta", () => {
    const out = ensureDocumentChangelog("# DBGA\n\nContenido.", {
      initialDescription: "Creación inicial del DBGA",
      initialDate: "Mayo 2026",
    });
    assert.equal(hasDocumentChangelogSection(out), true);
    assert.match(out, /\| 1\.0 \| Mayo 2026 \| Creación inicial del DBGA \|/);
  });

  it("ensureDocumentChangelog corrige fecha 1.0 si changelog ya existe", () => {
    const doc = `# BRD

## Registro de cambios del documento

| Versión | Fecha | Descripción del cambio |
| --- | --- | --- |
| 1.0 | Abril 2026 | Creación inicial del BRD |
| 1.1 | Mayo 2026 | Añadir RACI |`;
    const out = ensureDocumentChangelog(doc, { initialDate: "Julio 2026" });
    assert.match(out, /\| 1\.0 \| Julio 2026 \| Creación inicial del BRD \|/);
    assert.match(out, /\| 1\.1 \| Mayo 2026 \| Añadir RACI \|/);
  });

  it("fixDocumentChangelogInitialDate reemplaza fecha incorrecta del LLM", () => {
    const doc = `# Deep Research

## Registro de cambios del documento

| Versión | Fecha | Descripción del cambio |
| --- | --- | --- |
| 1.0 | Abril 2026 | Creación inicial del informe de Deep Research |`;
    const out = fixDocumentChangelogInitialDate(doc, "Julio 2026");
    assert.match(
      out,
      /\| 1\.0 \| Julio 2026 \| Creación inicial del informe de Deep Research \|/,
    );
    assert.doesNotMatch(out, /Abril 2026/);
  });

  it("getDocumentChangelogLlmInstructions inyecta fecha del sistema", () => {
    const out = getDocumentChangelogLlmInstructions(new Date(2026, 6, 14));
    assert.match(out, /«Julio 2026»/);
    assert.match(out, /\*\*Fecha obligatoria fila 1\.0:\*\* `Julio 2026`/);
  });

  it("parseLatestDocumentVersion devuelve la mayor versión", () => {
    const doc = `| 2.0 | Julio 2026 | Reestructuración |
| 2.8 | Julio 2026 | Jerarquía precio |`;
    assert.equal(parseLatestDocumentVersion(doc), "2.8");
  });

  it("bumpDocumentPatchVersion incrementa minor", () => {
    assert.equal(bumpDocumentPatchVersion("2.7"), "2.8");
    assert.equal(bumpDocumentPatchVersion("1.0"), "1.1");
  });

  it("bumpDocumentMinorVersion incrementa major", () => {
    assert.equal(bumpDocumentMinorVersion("1.9"), "2.0");
  });

  it("appendDocumentChangelogEntry añade fila preservando historial", () => {
    const doc = ensureDocumentChangelog("# MDD\n\nBody.", {
      initialDescription: "Creación inicial del MDD",
      initialDate: "Mayo 2026",
    });
    const out = appendDocumentChangelogEntry(doc, {
      version: "1.1",
      date: "Mayo 2026",
      description: "Añadir §5 edge cases",
    });
    assert.match(out, /\| 1\.0 \| Mayo 2026 \| Creación inicial del MDD \|/);
    assert.match(out, /\| 1\.1 \| Mayo 2026 \| Añadir §5 edge cases \|/);
  });

  it("documentBodyWithoutChangelog separa cuerpo y changelog", () => {
    const doc = `# Spec

Alcance MVP con entregables, criterios de aceptación y dependencias técnicas documentadas para el equipo.

## Registro de cambios del documento

| Versión | Fecha | Descripción del cambio |
| --- | --- | --- |
| 1.0 | Junio 2026 | Creación inicial del documento |`;
    assert.equal(
      documentBodyWithoutChangelog(doc),
      "# Spec\n\nAlcance MVP con entregables, criterios de aceptación y dependencias técnicas documentadas para el equipo.",
    );
    assert.equal(isChangelogOnlyDocument(doc), false);
  });

  it("isChangelogOnlyDocument detecta shell vacío post ensureDocumentChangelog", () => {
    const shell = ensureDocumentChangelog("");
    assert.equal(isChangelogOnlyDocument(shell), true);
  });
});
