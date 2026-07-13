import { describe, expect, it } from "vitest";
import {
  normalizeMermaidSequenceSyntax,
  prepareMermaidForRender,
} from "./mermaid-render-prep.util";
import { repairMermaidBlockForRender } from "./mermaid-fix.util";

describe("normalizeMermaidSequenceSyntax", () => {
  it("inserta sequenceDiagram si falta y arranca con participant", () => {
    const raw = "participant User\nUser->>Web: click";
    const out = normalizeMermaidSequenceSyntax(raw);
    expect(out).toMatch(/^sequenceDiagram/m);
  });

  it("corrige flecha con espacio User --> Web", () => {
    const raw = "sequenceDiagram\nUser --> Web: ok";
    const out = normalizeMermaidSequenceSyntax(raw);
    expect(out).toContain("User-->>Web");
  });
});

describe("repairMermaidBlockForRender", () => {
  it("normaliza bloque sequenceDiagram mal formado", () => {
    const broken = "participant A\nA --> B: msg";
    const out = repairMermaidBlockForRender(broken);
    expect(out).toMatch(/sequenceDiagram/i);
    expect(out).toContain("A-->>B");
  });

  it("prepareMermaidForRender es idempotente tras reparar", () => {
    const broken = "sequenceDiagram\nUser --> Stripe: pay";
    const once = repairMermaidBlockForRender(broken);
    const twice = prepareMermaidForRender(once);
    expect(twice).toBe(once);
  });
});
