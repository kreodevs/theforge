import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  prependDocumentTimestamps,
  extractDocumentTimestamps,
} from "./document-date-header.util.js";

describe("document-date-header", () => {
  const fixed = new Date("2026-07-15T10:30:00.000Z");
  const later = new Date("2026-07-16T14:45:00.000Z");

  it("prepends header on fresh content", () => {
    const out = prependDocumentTimestamps("# My Doc\n\nBody", fixed);
    assert.ok(out.startsWith("<!-- theforge-doc:created=2026-07-15"));
    assert.ok(out.includes("Generado:"));
    assert.ok(out.includes("Actualizado:"));
    assert.ok(out.includes("# My Doc"));
  });

  it("preserves original created date on re-stamp", () => {
    const first = prependDocumentTimestamps("# Doc", fixed);
    const second = prependDocumentTimestamps(first, later);

    const ts = extractDocumentTimestamps(second);
    assert.equal(ts.created?.toISOString(), fixed.toISOString());
    assert.equal(ts.updated?.toISOString(), later.toISOString());
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
});
