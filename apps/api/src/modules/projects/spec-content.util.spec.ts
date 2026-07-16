import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSpecMarkdown } from "./spec-content.util.js";
import { computeDocAccuracy } from "../engine/cascade-accuracy.util.js";

describe("normalizeSpecMarkdown", () => {
  it("convierte ## N. vacíos seguidos de criterio en viñetas", () => {
    const raw = `## 3. Criterios de Éxito

## 1.

**Autenticación funcional:** Tokens Bearer operativos.

## 2.

**Aislamiento multiinquilino:** RLS efectivo.`;

    const out = normalizeSpecMarkdown(raw);
    assert.match(out, /- \*\*Autenticación funcional:\*\*/);
    assert.match(out, /- \*\*Aislamiento multiinquilino:\*\*/);
    assert.doesNotMatch(out, /^##\s+\d+\.\s*$/m);
  });

  it("elimina penalización DocAccuracy por headings vacíos", () => {
    const raw = `# Spec

## 1.

**Journey A:** flujo principal.

## 2.

**Journey B:** flujo secundario.`;

    const before = computeDocAccuracy({ specMarkdown: raw, mddMarkdown: "# MDD\n\nx".repeat(80) });
    const after = computeDocAccuracy({
      specMarkdown: normalizeSpecMarkdown(raw),
      mddMarkdown: "# MDD\n\nx".repeat(80),
    });

    assert.ok(before.components.some((c) => c.gaps.includes("Spec journeys con headings vacíos")));
    assert.ok(!after.components.some((c) => c.gaps.includes("Spec journeys con headings vacíos")));
  });
});
