import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectPhase0Template,
  isDeepResearchMarkdown,
  PHASE0_TEMPLATE_LABELS,
} from "../phase0-template-detect.util.js";
import {
  formatAssistedChatMessage,
  isAssistedMetaQuestion,
  reformatForTemplate,
} from "../phase0-assisted.helpers.js";

describe("phase0 template detect", () => {
  it("detecta plantilla estructurada", () => {
    const md = `# Fase 0 — Especificación Inicial

## 1. Propósito y Alcance

Problema de negocio claro para usuarios.
`;
    assert.equal(detectPhase0Template({ dbgaContent: md }), "structured");
  });

  it("detecta DBGA libre", () => {
    const md = `# Domain Benchmark & Gap Analysis

## Industria

Referencia de mercado con suficiente texto para auditoría.
`.repeat(3);
    assert.equal(detectPhase0Template({ dbgaContent: md }), "freeform_dbga");
  });

  it("detecta deep research en phase0Summary", () => {
    const md = `# Especificador de Base para MDD

## Misión

Texto de deep research con matriz M/D y fuentes suficientes.
`.repeat(2);
    assert.equal(isDeepResearchMarkdown(md), true);
    assert.equal(
      detectPhase0Template({ phase0SummaryContent: md, dbgaContent: "" }),
      "deep_research",
    );
  });

  it("prioriza dbga sobre deep research", () => {
    const dbga = `# Domain Benchmark & Gap Analysis

Contenido libre de benchmark con gaps y riesgos de dominio.
`.repeat(3);
    const research = `# Especificador de Base para MDD

## Misión

Research previo.
`.repeat(2);
    assert.equal(
      detectPhase0Template({ dbgaContent: dbga, phase0SummaryContent: research }),
      "freeform_dbga",
    );
  });

  it("idea sin documento → structured", () => {
    assert.equal(detectPhase0Template({ idea: "App de turnos para clínicas" }), "structured");
  });
});

describe("phase0 assisted helpers", () => {
  it("reformatForTemplate aplica formatDocumentMarkdown", () => {
    const raw = `# Domain Benchmark & Gap Analysis

| a | b |
|---|---|
| 1 | 2 |
`;
    const { markdown } = reformatForTemplate("freeform_dbga", raw);
    assert.ok(markdown.includes("Domain Benchmark"));
  });

  it("formatAssistedChatMessage incluye impacto y pregunta", () => {
    const msg = formatAssistedChatMessage({
      templateLabel: PHASE0_TEMPLATE_LABELS.structured,
      impacto: "Se añadió el rol Admin.",
      cambios: ["Roles"],
      question: "¿Quién aprueba?",
      n: 2,
      total: 5,
    });
    assert.match(msg, /Impacto/);
    assert.match(msg, /Pregunta \(2\/5\)/);
    assert.match(msg, /Admin/);
  });

  it("isAssistedMetaQuestion detecta preguntas de auditoría", () => {
    assert.equal(isAssistedMetaQuestion("¿Qué falta en mi DBGA?"), true);
    assert.equal(isAssistedMetaQuestion("Implementar login OAuth"), false);
  });
});
