import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ComponentSourcePort } from "@theforge/component-source";
import {
  fetchOrbitaDesignSystemContext,
  formatDesignSystemContextBlock,
  formatDesignSystemTokens,
  formatDesignSystemTokensCompact,
  formatSketchDesignSystemContextBlock,
  mergeDesignSystemContext,
  mergeDesignSystemContextForSketches,
  prepareDesignSystemContextForSketches,
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

  it("fetchOrbitaDesignSystemContext degrada sin designSystem.get", async () => {
    const port = {
      capabilities: { catalog: { list: true } },
      checkHealth: async () => ({ ok: true }),
      getDesignSystem: async () => {
        throw new Error("should not be called");
      },
    } as unknown as ComponentSourcePort;
    const ctx = await fetchOrbitaDesignSystemContext(port, "user-1");
    assert.equal(ctx, undefined);
  });

  it("fetchOrbitaDesignSystemContext usa getDesignSystem cuando está mapeado", async () => {
    const port = {
      capabilities: { catalog: { list: true }, designSystem: { get: true } },
      checkHealth: async () => ({ ok: true }),
      getDesignSystem: async () => ({
        content: [{ type: "text", text: JSON.stringify({ designMd: "# DS tokens" }) }],
      }),
    } as unknown as ComponentSourcePort;
    const ctx = await fetchOrbitaDesignSystemContext(port, "user-1");
    assert.equal(ctx, "# DS tokens");
  });

  it("prepareDesignSystemContextForSketches omite secciones no visuales", () => {
    const md = `---
colors:
  primary: "#112233"
---

## Colores
Primario.

## Arquitectura
${"x".repeat(800)}`;
    const ctx = prepareDesignSystemContextForSketches(md, 2000);
    assert.ok(ctx.includes("primary"));
    assert.ok(ctx.includes("Colores"));
    assert.ok(!ctx.includes("Arquitectura"));
  });

  it("mergeDesignSystemContextForSketches usa solo Orbita si basta", () => {
    const orbita = `---\ncolors:\n  primary: "#abc"\n---\n## Colores\nAzul.`;
    const merged = mergeDesignSystemContextForSketches("guía ux larga", orbita);
    assert.equal(merged, orbita);
  });

  it("formatSketchDesignSystemContextBlock es compacto", () => {
    const block = formatSketchDesignSystemContextBlock("tokens");
    assert.ok(block.includes("tokens"));
    assert.ok(!block.includes("No inventes colores hex"));
  });

  it("formatDesignSystemTokensCompact no pretty-print", () => {
    const compact = formatDesignSystemTokensCompact({
      tokens: { colors: { primary: "#abc" }, meta: { version: 1 } },
    } as Parameters<typeof formatDesignSystemTokensCompact>[0]);
    assert.ok(compact.includes('"primary":"#abc"') || compact.includes('"primary": "#abc"'));
    assert.ok(!compact.includes("meta"));
  });
});
