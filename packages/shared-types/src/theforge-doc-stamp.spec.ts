import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import {
  formatTheforgeDocTimestampsForDisplay,
  parseTheforgeDocTimestamps,
  peelDocumentBodyForPersist,
  peelTheforgeDocStamp,
  reattachTheforgeDocStamp,
} from "./theforge-doc-stamp.js";

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

  it("parseTheforgeDocTimestamps reads ISO from HTML comment", () => {
    const ts = parseTheforgeDocTimestamps(STAMPED);
    assert.equal(ts.created, "2026-07-15T10:30:45.000Z");
    assert.equal(ts.updated, "2026-07-16T14:45:30.000Z");
  });

  it("formatTheforgeDocTimestampsForDisplay includes seconds", () => {
    const display = formatTheforgeDocTimestampsForDisplay(parseTheforgeDocTimestamps(STAMPED));
    assert.ok(display);
    assert.ok(display!.created.includes("10:30:45"));
    assert.ok(display!.updated.includes("14:45:30"));
  });

  it("peels blockquote stamp without --- before H1", () => {
    const raw =
      "<!-- theforge-doc:created=2026-07-16T03:28:39.226Z|updated=2026-07-16T03:28:39.226Z -->\n" +
      "> 📅 Creado: 16 de julio de 2026, 03:28:39 UTC · Última regeneración: 16 de julio de 2026, 03:28:39 UTC\n\n" +
      "# Specs\n";
    const { stamp, body } = peelTheforgeDocStamp(raw);
    assert.ok(stamp.includes("theforge-doc:created="));
    assert.ok(stamp.includes("Creado:"));
    assert.ok(body.startsWith("# Specs"));
  });

  it("peels glued blockquote stamp before --- and H1", () => {
    const raw =
      "<!-- theforge-doc:created=2026-07-16T03:28:39.226Z|updated=2026-07-16T03:28:39.226Z -->\n" +
      "> 📅 Creado: 16 de julio de 2026, 03:28:39 UTC · Última regeneración: 16 de julio de 2026, 03:28:39 UTC --- # Specs\n";
    const { stamp, body } = peelTheforgeDocStamp(raw);
    assert.ok(stamp.includes("Creado:"));
    assert.ok(body.startsWith("# Specs"));
  });

  it("peels orphan --> before blockquote stamp", () => {
    const raw =
      "--> > 📅 Creado: 16 de julio de 2026, 03:28:39 UTC · Última regeneración: 16 de julio de 2026, 03:28:39 UTC\n\n# Specs\n";
    const { stamp, body } = peelTheforgeDocStamp(raw);
    assert.ok(stamp.includes("📅"));
    assert.ok(body.startsWith("# Specs"));
  });

  it("peels truncated ISO close and glued stamp before H1", () => {
    const raw =
      "Última modificación: 2026-07-18T05:06:06.701Z --> 📅 Creado: 18 de julio de 2026, 05:06:06 UTC · Última modificación: 18 de julio de 2026, 05:06:06 UTC --- # Master Design Document\n\n## 1. Contexto\n";
    const { stamp, body } = peelTheforgeDocStamp(raw);
    assert.ok(stamp.includes("📅"));
    assert.ok(body.startsWith("# Master Design Document"));
    assert.doesNotMatch(body, /Última modificación:/);
  });

  it("repairInlineHorizontalRuleSectionBreaks splits glued section headings", () => {
    const raw =
      "# Master Design Document --- ## 1. Contexto --- ## 2. Arquitectura y Stack\n\nTexto.";
    const { body } = peelTheforgeDocStamp(raw);
    assert.match(body, /^# Master Design Document\n\n---\n\n## 1\. Contexto/);
    assert.match(body, /## 2\. Arquitectura y Stack/);
  });

  it("peels current API stamp with Última modificación label", () => {
    const raw =
      "<!-- theforge-doc:created=2026-07-18T05:06:06.701Z|updated=2026-07-18T05:06:06.701Z -->\n" +
      "> 📅 Creado: 18 de julio de 2026, 05:06:06 UTC · Última modificación: 18 de julio de 2026, 05:06:06 UTC\n\n" +
      "---\n\n# Master Design Document\n";
    const { body } = peelTheforgeDocStamp(raw);
    assert.equal(body.trim(), "# Master Design Document");
  });

  it("formatTheforgeDocTimestampsForDisplay accepts custom timezone", () => {
    const display = formatTheforgeDocTimestampsForDisplay(parseTheforgeDocTimestamps(STAMPED), {
      timeZone: "America/Mexico_City",
    });
    assert.ok(display);
    assert.doesNotMatch(display!.created, / UTC$/);
  });

  it("peelDocumentBodyForPersist splits glued §1 and §2 from stamp residue", () => {
    const raw =
      "Última modificación: 2026-07-18T06:25:57.540Z --> 📅 Creado: 18 de julio de 2026, 06:25:57 UTC · Última modificación: 18 de julio de 2026, 06:25:57 UTC --- # Master Design Document --- ## 1. Contexto y alcance --- ## 2. Arquitectura y Stack ### 2.1 Visión";
    const body = peelDocumentBodyForPersist(raw);
    assert.match(body, /^# Master Design Document\n\n---\n\n## 1\. Contexto y alcance/);
    assert.match(body, /## 2\. Arquitectura y Stack/);
    assert.doesNotMatch(body, /📅|Última modificación:/);
  });

  it("peelDocumentBodyForPersist strips double-stamped blockquote with inline sections", () => {
    const raw =
      "<!-- theforge-doc:created=2026-07-18T06:25:57.540Z|updated=2026-07-18T06:25:57.540Z -->\n" +
      "> 📅 Creado: 18 de julio de 2026, 06:25:57 UTC · Última modificación: 18 de julio de 2026, 06:25:57 UTC --- # Master Design Document --- ## 1. Contexto --- ## 2. Stack\n\n## 3. Modelo";
    const body = peelDocumentBodyForPersist(raw);
    assert.match(body, /^# Master Design Document/);
    assert.match(body, /## 3\. Modelo/);
    assert.doesNotMatch(body, /📅/);
  });

  it("formatDocumentMarkdown preserves stamp ISO and human header", () => {
    const out = formatDocumentMarkdown(STAMPED);
    assert.ok(out.includes("<!-- theforge-doc:created=2026-07-15T10:30:45.000Z|updated="));
    assert.ok(out.includes("Creado:"));
    assert.ok(out.includes("# Título"));
  });
});
