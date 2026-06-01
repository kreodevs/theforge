import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDesignSystemContextBlock,
  formatDesignSystemTokens,
  mergeDesignSystemContext,
  prepareDesignSystemContextForWireframes,
} from "./wireframe-design-system-context.util.js";

describe("wireframe-design-system-context", () => {
  it("extrae YAML frontmatter y cuerpo", () => {
    const md = `---
colors:
  primary: "#112233"
typography:
  body-md:
    fontSize: 14px
---

## Colores
Primario para CTAs.

## Otro
Texto largo ${"x".repeat(500)}`;
    const ctx = prepareDesignSystemContextForWireframes(md, 2000);
    assert.ok(ctx.includes('primary: "#112233"'));
    assert.ok(ctx.includes("Colores"));
  });

  it("formatDesignSystemContextBlock vacío si no hay guía", () => {
    assert.equal(formatDesignSystemContextBlock(""), "");
    assert.equal(formatDesignSystemContextBlock(undefined), "");
  });

  it("formatDesignSystemContextBlock incluye aviso obligatorio", () => {
    const block = formatDesignSystemContextBlock("tokens here");
    assert.ok(block.includes("OBLIGATORIO"));
    assert.ok(block.includes("tokens here"));
  });

  it("mergeDesignSystemContext prioriza Orbita y complementa con UX", () => {
    const merged = mergeDesignSystemContext("ux tokens", "orbita tokens");
    assert.ok(merged.includes("fuente de verdad"));
    assert.ok(merged.includes("orbita tokens"));
    assert.ok(merged.includes("complemento"));
    assert.ok(merged.includes("ux tokens"));
  });

  it("mergeDesignSystemContext sin Orbita devuelve solo UX", () => {
    assert.equal(mergeDesignSystemContext("ux only", undefined), "ux only");
    assert.equal(mergeDesignSystemContext("ux only", ""), "ux only");
  });

  it("formatDesignSystemTokens serializa tokens y cssVars", () => {
    const formatted = formatDesignSystemTokens({
      tokens: { colors: { primary: "#abc" } },
      cssVars: { "--color-primary": "#abc" },
    } as Parameters<typeof formatDesignSystemTokens>[0]);
    assert.ok(formatted.includes("colors"));
    assert.ok(formatted.includes("--color-primary"));
  });
});
