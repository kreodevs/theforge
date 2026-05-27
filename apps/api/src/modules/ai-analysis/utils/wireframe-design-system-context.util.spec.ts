import { describe, expect, it } from "vitest";
import {
  formatDesignSystemContextBlock,
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
    expect(ctx).toContain('primary: "#112233"');
    expect(ctx).toContain("Colores");
  });

  it("formatDesignSystemContextBlock vacío si no hay guía", () => {
    expect(formatDesignSystemContextBlock("")).toBe("");
    expect(formatDesignSystemContextBlock(undefined)).toBe("");
  });

  it("formatDesignSystemContextBlock incluye aviso obligatorio", () => {
    const block = formatDesignSystemContextBlock("tokens here");
    expect(block).toContain("OBLIGATORIO");
    expect(block).toContain("tokens here");
  });
});
