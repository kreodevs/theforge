import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMermaidSequenceSyntax,
  prepareMermaidForRender,
} from "./mermaid-render-prep.util.js";
import { repairMermaidBlockForRender } from "./mermaid-fix.util.js";

describe("normalizeMermaidSequenceSyntax", () => {
  it("inserta sequenceDiagram si falta y arranca con participant", () => {
    const raw = "participant User\nUser->>Web: click";
    const out = normalizeMermaidSequenceSyntax(raw);
    assert.match(out, /^sequenceDiagram/m);
  });

  it("corrige flecha con espacio User --> Web", () => {
    const raw = "sequenceDiagram\nUser --> Web: ok";
    const out = normalizeMermaidSequenceSyntax(raw);
    assert.ok(out.includes("User-->>Web"));
  });
});

describe("repairMermaidBlockForRender", () => {
  it("normaliza bloque sequenceDiagram mal formado", () => {
    const broken = "participant A\nA --> B: msg";
    const out = repairMermaidBlockForRender(broken);
    assert.match(out, /sequenceDiagram/i);
    assert.ok(out.includes("A-->>B"));
  });

  it("prepareMermaidForRender es idempotente tras reparar", () => {
    const broken = "sequenceDiagram\nUser --> Stripe: pay";
    const once = repairMermaidBlockForRender(broken);
    const twice = prepareMermaidForRender(once);
    assert.equal(twice, once);
  });
});
