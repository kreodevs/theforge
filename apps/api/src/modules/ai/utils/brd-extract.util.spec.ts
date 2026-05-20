import { describe, it } from "node:test";
import assert from "node:assert";
import {
  extractBrdFromLlmResponse,
  isCorruptedBrdLlmText,
  brdGenerationErrorMessage,
} from "./brd-extract.util.js";

const SAMPLE_BRD = `# Business Requirements Document

## Pain Points & Problem Statement

| Dolor | Impacto |
|-------|---------|
| Costos opacos | Alto |

## Alcance

RF-1: Integración OBP para gestión de costos.
`;

describe("extractBrdFromLlmResponse", () => {
  it("extrae con delimitadores <<<BRD>>>", () => {
    const raw = `<<<BRD>>>\n${SAMPLE_BRD}\n<<<END_BRD>>>`;
    const r = extractBrdFromLlmResponse(raw);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.method, "delimited");
      assert.ok(r.content.includes("Pain Points"));
    }
  });

  it("extrae con ---FIN_BRD--- (formato Workshop)", () => {
    const raw = `${SAMPLE_BRD}\n---FIN_BRD---\nListo.`;
    const r = extractBrdFromLlmResponse(raw);
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.method === "fin_brd" || r.method === "markdown");
  });

  it("extrae BRD sin delimitador cuando el markdown es reconocible", () => {
    const r = extractBrdFromLlmResponse(SAMPLE_BRD);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.method, "markdown");
  });

  it("acepta <<<BRD>>> sin cierre cuando el cuerpo es sustancial", () => {
    const raw = `<<<BRD>>>\n${SAMPLE_BRD}`;
    const r = extractBrdFromLlmResponse(raw);
    assert.equal(r.ok, true);
    if (r.ok) assert.ok(r.method === "delimited_open" || r.method === "markdown");
  });

  it("rechaza salida corrupta con thinking y Press Reply", () => {
    const corrupted = `<thinking>planning...</thinking>\nPress Reply to continue\nfoo`;
    assert.ok(isCorruptedBrdLlmText(corrupted));
    const r = extractBrdFromLlmResponse(corrupted);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.failure, "corrupted");
  });

  it("rechaza respuesta vacía", () => {
    const r = extractBrdFromLlmResponse("   ");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.failure, "empty");
  });
});

describe("brdGenerationErrorMessage", () => {
  it("menciona truncado de DBGA cuando aplica", () => {
    const msg = brdGenerationErrorMessage("no_delimiter", { dbgaTruncated: true, rawLength: 500 });
    assert.ok(msg.includes("truncado") || msg.includes("extenso"));
    assert.ok(msg.includes("500"));
  });
});
