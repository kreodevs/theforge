import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAssistedAnswerLocalFallback, patchMarkdownUsuarios } from "../phase0-assisted-fallback.util.js";
import { heuristicBorradorFromFreeformDbga } from "../phase0-load-borrador.util.js";
import { analyzeGaps } from "../phase0-gap-analyzer.js";
import type { Phase0InterviewState } from "../phase0.types.js";
import { emptyPhase0Document } from "../phase0-normalize.util.js";

describe("patchMarkdownUsuarios", () => {
  it("añade viñeta bajo Usuarios objetivo existente", () => {
    const md = `# DBGA

## 1. Propósito

**Usuarios objetivo:**
- Inversor
`;
    const next = patchMarkdownUsuarios(md, "Hermano (uso privado)");
    assert.match(next, /Hermano \(uso privado\)/);
    assert.match(next, /Inversor/);
  });
});

describe("applyAssistedAnswerLocalFallback", () => {
  it("incorpora usuarios y elimina gap cuando falla el LLM", () => {
    const state: Phase0InterviewState = {
      projectId: "p1",
      threadId: "t1",
      borrador: emptyPhase0Document(),
      gaps: analyzeGaps(emptyPhase0Document()),
      preguntasRealizadas: 0,
      maxPreguntas: 5,
      questionPlan: [],
      planCursor: 0,
      status: "interviewing",
      inputRaw: "",
      inputType: "external_doc",
      historial: [],
      mode: "assisted",
      sourceFormat: "freeform_dbga",
      workingMarkdown: "## 1. Propósito\n\n**Problema:** Trading\n",
      ultimaPregunta: "¿Quiénes van a usar este sistema?",
    };

    const result = applyAssistedAnswerLocalFallback({
      state,
      answer: "Mi hermano y yo, uso privado",
      templateKind: "freeform_dbga",
    });

    assert.ok(result.cambios.includes("proposito.usuarios"));
    assert.equal(state.borrador.proposito.usuarios.length, 1);
    assert.match(state.workingMarkdown ?? "", /Mi hermano y yo/);
    assert.equal(
      state.gaps.some((g) => g.descripcion.includes("usuarios objetivo")),
      false,
    );
  });
});

describe("heuristicBorradorFromFreeformDbga", () => {
  it("extrae reglas y usuarios de DBGA con numeración no canónica", () => {
    const md = `# Domain Benchmark & Gap Analysis (DBGA)

## 1. Propósito y Alcance

**Problema:** Automatizar trading semanal.

**Usuarios objetivo:**
- **Inversor:** Titular de cuenta.
- **Superadmin:** Administración global.

## 5. Reglas de Negocio

- **R5.1** - Ventana semanal de ejecución.
- **R5.2** - Idempotencia de señales.

## 7. Roles y Permisos

| Rol | Permisos |
| :-- | :-- |
| Inversor | Lectura/Escritura |
| Superadmin | Global |
`.repeat(2);

    const doc = heuristicBorradorFromFreeformDbga(md);
    assert.ok(doc.proposito.usuarios.length >= 2);
    assert.ok(doc.reglasNegocio.length >= 2);
    assert.ok(doc.roles.length >= 2);
    assert.equal(analyzeGaps(doc).some((g) => g.descripcion.includes("usuarios objetivo")), false);
    assert.equal(analyzeGaps(doc).some((g) => g.descripcion.includes("reglas de negocio")), false);
  });
});
