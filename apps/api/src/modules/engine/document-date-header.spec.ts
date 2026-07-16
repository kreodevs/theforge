import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prependDocumentTimestamps,
  extractDocumentTimestamps,
  stampMarkdownIfBodyChanged,
  documentMarkdownBodiesEqual,
} from "./document-date-header.util.js";

describe("document-date-header", () => {
  const fixed = new Date("2026-07-15T10:30:45.000Z");
  const later = new Date("2026-07-16T14:45:30.000Z");

  it("prepends header on fresh content", () => {
    const out = prependDocumentTimestamps("# My Doc\n\nBody", fixed);
    assert.ok(out.startsWith("<!-- theforge-doc:created=2026-07-15"));
    assert.ok(out.includes("Creado:"));
    assert.ok(out.includes("Última regeneración:"));
    assert.ok(out.includes("10:30:45"));
    assert.ok(out.includes("# My Doc"));
  });

  it("preserves original created date on re-stamp", () => {
    const first = prependDocumentTimestamps("# Doc", fixed);
    const second = prependDocumentTimestamps(first, later);

    const ts = extractDocumentTimestamps(second);
    assert.equal(ts.created?.toISOString(), fixed.toISOString());
    assert.equal(ts.updated?.toISOString(), later.toISOString());
    assert.ok(second.includes("14:45:30"));
  });

  it("strips legacy Generado/Actualizado header on re-stamp", () => {
    const legacy =
      "<!-- theforge-doc:created=2026-07-01T08:00:00.000Z|updated=2026-07-01T08:00:00.000Z -->\n" +
      "> 📅 Generado: 1 jul 2026, 08:00 UTC · Actualizado: 1 jul 2026, 08:00 UTC\n\n" +
      "---\n\n" +
      "# Doc";
    const out = prependDocumentTimestamps(legacy, later);
    assert.ok(out.includes("Creado:"));
    assert.ok(out.includes("Última regeneración:"));
    assert.ok(!out.includes("Generado:"));
    assert.equal(extractDocumentTimestamps(out).created?.toISOString(), "2026-07-01T08:00:00.000Z");
  });

  it("returns empty object for content without header", () => {
    const ts = extractDocumentTimestamps("just plain text");
    assert.equal(ts.created, undefined);
    assert.equal(ts.updated, undefined);
  });

  it("body is preserved after header", () => {
    const body = "# Title\n\nSome body text.";
    const out = prependDocumentTimestamps(body, fixed);
    const afterHeader = out.replace(/^.*?---\n\n/s, "");
    assert.equal(afterHeader, body);
  });

  it("stampMarkdownIfBodyChanged preserves existing when body unchanged", () => {
    const body = "# Doc\n\nSame.";
    const stamped = prependDocumentTimestamps(body, fixed);
    const again = stampMarkdownIfBodyChanged(stamped, body, later);
    assert.equal(again, stamped);
    assert.equal(extractDocumentTimestamps(again).updated?.toISOString(), fixed.toISOString());
  });

  it("stampMarkdownIfBodyChanged re-stamps when body changes", () => {
    const body = "# Doc\n\nOld.";
    const stamped = prependDocumentTimestamps(body, fixed);
    const next = stampMarkdownIfBodyChanged(stamped, "# Doc\n\nNew.", later);
    assert.notEqual(next, stamped);
    assert.equal(extractDocumentTimestamps(next).updated?.toISOString(), later.toISOString());
  });

  it("documentMarkdownBodiesEqual ignores stamp metadata", () => {
    const body = "# X\n";
    assert.equal(
      documentMarkdownBodiesEqual(prependDocumentTimestamps(body, fixed), body),
      true,
    );
  });
});
