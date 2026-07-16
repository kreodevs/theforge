/**
 * Tests for BRD digest extraction (Clarifier Phase 1).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRD_DIGEST_INPUT_THRESHOLD,
  BRD_DIGEST_TARGET_MAX,
  extractBrdDigest,
} from "./extract-brd-digest.js";

function buildLargeBrd(chars: number): string {
  const sections = [
    "## 1. Contexto\n\nProblema de negocio central.",
    "## 3. Capacidades\n### 3.1 Gestión de pedidos\nCRUD pedidos y clientes.\n### 3.2 Inventario\nStock y almacenes.",
    "## Métricas de éxito\n- KPI: tiempo de respuesta < 200ms\n- KPI: disponibilidad 99.9%",
    "## Fuera del alcance\nIntegración legacy SAP.",
    "```sql\nCREATE TABLE orders (id UUID PRIMARY KEY);\nCREATE TABLE customers (id UUID PRIMARY KEY);\n```",
  ];
  let body = sections.join("\n\n");
  while (body.length < chars) {
    body += `\n\n### 3.${Math.floor(body.length / 100)} Módulo extra ${"x".repeat(80)}`;
  }
  return body;
}

describe("extractBrdDigest", () => {
  it("returns input unchanged when below threshold", () => {
    const small = "## 1. Contexto\n\nCorto.";
    const { digest, usedDigest, originalLen } = extractBrdDigest(small);
    assert.equal(usedDigest, false);
    assert.equal(digest, small);
    assert.equal(originalLen, small.length);
  });

  it("condenses large BRD to digest within target max", () => {
    const large = buildLargeBrd(BRD_DIGEST_INPUT_THRESHOLD + 5_000);
    assert.ok(large.length > BRD_DIGEST_INPUT_THRESHOLD);
    const { digest, usedDigest, originalLen } = extractBrdDigest(large);
    assert.equal(usedDigest, true);
    assert.equal(originalLen, large.length);
    assert.ok(digest.length <= BRD_DIGEST_TARGET_MAX + 50);
    assert.ok(digest.length >= 1_000);
    assert.match(digest, /BRD Digest/i);
    assert.match(digest, /orders|customers|KPI|pedidos/i);
  });

  it("preserves MVP module headings in digest", () => {
    const large = buildLargeBrd(20_000);
    const { digest } = extractBrdDigest(large);
    assert.match(digest, /3\.1|Módulos|capacidades/i);
  });
});
