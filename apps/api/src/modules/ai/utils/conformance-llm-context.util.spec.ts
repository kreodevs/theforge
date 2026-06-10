import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CONFORMANCE_LLM_CHAR_LIMIT,
  CONFORMANCE_LLM_TRUNCATION_MARKER,
  truncateForConformanceLlm,
} from "./conformance-llm-context.util.js";

describe("truncateForConformanceLlm", () => {
  it("devuelve texto intacto bajo el límite", () => {
    const text = "abc".repeat(100);
    assert.equal(truncateForConformanceLlm(text), text);
  });

  it("trunca y añade marcador al exceder CONFORMANCE_LLM_CHAR_LIMIT", () => {
    const text = "x".repeat(CONFORMANCE_LLM_CHAR_LIMIT + 500);
    const out = truncateForConformanceLlm(text);
    assert.ok(out.endsWith(CONFORMANCE_LLM_TRUNCATION_MARKER));
    assert.equal(out.length, CONFORMANCE_LLM_CHAR_LIMIT + 1 + CONFORMANCE_LLM_TRUNCATION_MARKER.length);
  });
});
