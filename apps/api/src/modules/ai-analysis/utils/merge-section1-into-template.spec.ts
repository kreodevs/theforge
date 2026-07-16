/**
 * Tests for clarifier scope-only mddDraft assembly (Phase 0).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMddDraftFromClarifierOutput,
  mergeSection1IntoTemplate,
} from "./merge-section1-into-template.js";
import { MDD_SECTION_ORDER } from "../state/mdd-structured.schema.js";

const SECTION1 = `### Propósito

Sistema de facturación electrónica.

### Objetivos

- Cumplir SAT
- Aprobación dual`;

describe("mergeSection1IntoTemplate", () => {
  it("builds canonical 7-section skeleton with §1 content", () => {
    const draft = mergeSection1IntoTemplate(SECTION1, "**Entidades:** invoices");
    assert.match(draft, /^# Master Design Document/);
    assert.match(draft, /## 1\. Contexto/);
    assert.match(draft, /Sistema de facturación electrónica/);
    for (const section of MDD_SECTION_ORDER.slice(1)) {
      assert.match(draft, new RegExp(`## ${section.replace(".", "\\.")}`));
    }
    assert.match(draft, /## 2\. Arquitectura y Stack[\s\S]*\(Pendiente\)/);
  });

  it("throws when contextoAlcance is empty", () => {
    assert.throws(
      () => mergeSection1IntoTemplate("  "),
      /Clarifier no pudo estructurar el alcance del BRD/,
    );
  });
});

describe("buildMddDraftFromClarifierOutput", () => {
  const previousDraft = `# Master Design Document

## 1. Contexto

Antiguo.

## 2. Arquitectura y Stack

NestJS + PostgreSQL.

## 3. Modelo de Datos

(Pendiente)

## 4. Contratos de API

(Pendiente)

## 5. Lógica y Edge Cases

(Pendiente)

## 6. Seguridad

(Pendiente)

## 7. Infraestructura

(Pendiente)`;

  it("preserves §2–7 when refining substantial draft", () => {
    const merged = buildMddDraftFromClarifierOutput({
      contextoAlcance: SECTION1,
      clarifiedScope: "**Entidades:** invoices",
      previousDraft: previousDraft,
      preserveSectionsBeyond1: true,
    });
    assert.match(merged, /Sistema de facturación electrónica/);
    assert.match(merged, /NestJS \+ PostgreSQL/);
    assert.doesNotMatch(merged, /Antiguo\./);
  });

  it("uses template only on first pass", () => {
    const draft = buildMddDraftFromClarifierOutput({
      contextoAlcance: SECTION1,
      preserveSectionsBeyond1: false,
    });
    assert.match(draft, /\(Pendiente\)/);
    assert.doesNotMatch(draft, /NestJS/);
  });
});
