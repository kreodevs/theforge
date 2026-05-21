/**
 * Smoke: utilidades puras del frontend (sin DOM ni Vite dev server).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cn, formatCurrency } from "../lib/utils.ts";
import { parseNdjsonLine } from "../utils/ndjson.ts";
import { parseErrorBodyText } from "../utils/httpError.ts";
import { parseMarkdownSections } from "../utils/markdownSections.ts";
import {
  isModelsUnavailableStreamError,
  MODELS_UNAVAILABLE_CODE,
} from "../utils/llm-stream-error.ts";
import { HIGH_GREENFIELD_FLOW_STEPS } from "../utils/workshopFlowOrder.ts";
import { resolveRef } from "../components/design-system-utils.ts";
import type { DesignTokens } from "../components/design-system-types.ts";

describe("smoke web: lib/utils", () => {
  it("cn combina clases", () => {
    assert.equal(cn("px-2", "px-4"), "px-4");
  });

  it("formatCurrency formatea MXN", () => {
    assert.match(formatCurrency(1000), /\$/);
  });
});

describe("smoke web: streaming y errores", () => {
  it("parseNdjsonLine extrae objetos JSON", () => {
    const rows = parseNdjsonLine('{"type":"progress","pct":1}\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.type, "progress");
  });

  it("parseErrorBodyText lee message Nest", () => {
    const msg = parseErrorBodyText('{"message":"Token inválido"}', "fallback");
    assert.equal(msg, "Token inválido");
  });

  it("isModelsUnavailableStreamError reconoce código API", () => {
    assert.equal(
      isModelsUnavailableStreamError({ code: MODELS_UNAVAILABLE_CODE }),
      true,
    );
  });
});

describe("smoke web: workshop / markdown", () => {
  it("parseMarkdownSections divide por ##", () => {
    const sections = parseMarkdownSections("## Uno\n\nA\n\n## Dos\n\nB\n");
    assert.equal(sections.length, 2);
    assert.equal(sections[0]?.id, "section-0");
    assert.match(sections[0]?.content ?? "", /Uno/);
    assert.equal(sections[1]?.id, "section-1");
  });

  it("workshopFlowOrder exporta pasos greenfield", () => {
    assert.ok(HIGH_GREENFIELD_FLOW_STEPS.length >= 5);
    assert.match(HIGH_GREENFIELD_FLOW_STEPS[0]?.label ?? "", /Paso/i);
  });
});

describe("smoke web: design-system", () => {
  it("resolveRef resuelve tokens anidados", () => {
    const tokens = {
      colors: { accent: "#112233" },
    } as unknown as DesignTokens;
    assert.equal(resolveRef("{colors.accent}", tokens), "#112233");
  });
});
