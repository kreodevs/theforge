import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countClarificationMarkers,
  extractClarificationItems,
  hasPendingClarifications,
} from "./document-clarification.js";

describe("document-clarification", () => {
  it("extractClarificationItems parsea preguntas con id estable", () => {
    const md =
      "Texto [NEEDS CLARIFICATION: ¿API versionada?] y otro [NEEDS CLARIFICATION: ¿HMAC?]";
    const items = extractClarificationItems(md);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.id, "clarify-0");
    assert.equal(items[0]?.question, "¿API versionada?");
    assert.equal(items[1]?.id, "clarify-1");
    assert.equal(items[1]?.question, "¿HMAC?");
  });

  it("countClarificationMarkers y hasPendingClarifications", () => {
    const md = "- [NEEDS CLARIFICATION]\n- [NEEDS CLARIFICATION: foo]";
    assert.equal(countClarificationMarkers(md), 2);
    assert.equal(hasPendingClarifications(md), true);
    assert.equal(hasPendingClarifications("# Spec limpio"), false);
  });
});
