import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import { peelTheforgeDocStamp, reattachTheforgeDocStamp } from "./theforge-doc-stamp.js";

const STAMPED = `<!-- theforge-doc:created=2026-07-15T10:30:45.000Z|updated=2026-07-16T14:45:30.000Z -->
> 📅 Creado: 15 de julio de 2026, 10:30:45 UTC · Última regeneración: 16 de julio de 2026, 14:45:30 UTC

---

# Título

## 1. Sección

Hola
`;

describe("theforge-doc-stamp", () => {
  it("peels meta + human header", () => {
    const { stamp, body } = peelTheforgeDocStamp(STAMPED);
    assert.ok(stamp.includes("theforge-doc:created="));
    assert.ok(stamp.includes("Creado:"));
    assert.ok(stamp.includes("10:30:45"));
    assert.ok(body.startsWith("# Título"));
  });

  it("reattach restores stamp before body", () => {
    const { stamp, body } = peelTheforgeDocStamp(STAMPED);
    const out = reattachTheforgeDocStamp(stamp, body);
    assert.ok(out.startsWith("<!-- theforge-doc:created="));
    assert.ok(out.includes("# Título"));
  });

  it("formatDocumentMarkdown preserves Creado / Última regeneración with seconds", () => {
    const out = formatDocumentMarkdown(STAMPED);
    assert.ok(out.includes("<!-- theforge-doc:created=2026-07-15T10:30:45.000Z|updated="));
    assert.ok(out.includes("Creado:"));
    assert.ok(out.includes("Última regeneración:"));
    assert.ok(out.includes("10:30:45"));
    assert.ok(out.includes("14:45:30"));
    assert.ok(out.includes("# Título"));
  });
});
