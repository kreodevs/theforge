import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRD_MERMAID_MIN_FENCE_COUNT,
  countMermaidFences,
  hasListPrefixedDiagramLinesOutsideFences,
  hasUnfencedDiagramHeaders,
  validateBrdMermaidOutput,
} from "./brd-mermaid-validate.util.js";

describe("validateBrdMermaidOutput", () => {
  it("acepta BRD con 4+ fences mermaid bien formados", () => {
    const body = `## 4. Diagramas

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`mermaid
erDiagram
  A ||--|| B
\`\`\`

\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
\`\`\`

\`\`\`mermaid
sequenceDiagram
  A->>B: msg
\`\`\``;
    const r = validateBrdMermaidOutput(body);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.fenceCount, 4);
  });

  it("rechaza diagramas sin fence y aristas en listas", () => {
    const bad = `## 4. Diagramas

flowchart LR
  A --> B
- A -->|"sync"| C`;
    const r = validateBrdMermaidOutput(bad);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.issues.includes("missing_mermaid_fences"));
      assert.ok(r.issues.includes("unfenced_diagram_header"));
      assert.ok(r.issues.includes("list_prefixed_diagram_line"));
    }
  });
});

describe("brd mermaid heuristics", () => {
  it("countMermaidFences", () => {
    assert.equal(countMermaidFences("```mermaid\na\n```\n```mermaid\nb\n```"), 2);
  });

  it("hasUnfencedDiagramHeaders detecta erDiagram suelto", () => {
    assert.equal(hasUnfencedDiagramHeaders("erDiagram\n  A {"), true);
    assert.equal(hasUnfencedDiagramHeaders("```mermaid\nerDiagram\n```"), false);
  });

  it("hasListPrefixedDiagramLinesOutsideFences", () => {
    assert.equal(hasListPrefixedDiagramLinesOutsideFences('- OBP -->|"x"| CAT'), true);
    assert.equal(
      hasListPrefixedDiagramLinesOutsideFences('```mermaid\n- OBP --> CAT\n```'),
      false,
    );
  });

  it("BRD_MERMAID_MIN_FENCE_COUNT es 4", () => {
    assert.equal(BRD_MERMAID_MIN_FENCE_COUNT, 4);
  });
});
