/**
 * Golden tests — red de seguridad Fase 0 (GOD-REFACTOR).
 * Fixtures en `fixtures/mdd/*.in.*` / `*.out.*`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  jsonSectionToMarkdown,
  prepareMddMarkdownForPersist,
  normalizeMddEnglishSubheadings,
  sanitizeSeguridadIntegracionRawJson,
} from "./mdd-sanitize.js";
import {
  assertGoldenEqual,
  loadGoldenFixture,
} from "./mdd-golden.util.js";

describe("mdd-sanitize golden fixtures (Fase 0)", () => {
  it("01-json-section: jsonSectionToMarkdown title+content", () => {
    const input = loadGoldenFixture("01-json-section", "in", "json");
    const expected = loadGoldenFixture("01-json-section", "out", "md");
    const actual = jsonSectionToMarkdown(input, "1. Contexto");
    assertGoldenEqual(actual, expected, "01-json-section");
  });

  it("02-prepare-peel-hr: prepareMddMarkdownForPersist despega headings", () => {
    const input = loadGoldenFixture("02-prepare-peel-hr", "in", "md");
    const expected = loadGoldenFixture("02-prepare-peel-hr", "out", "md");
    const actual = prepareMddMarkdownForPersist(input);
    assertGoldenEqual(actual, expected, "02-prepare-peel-hr");
  });

  it("03-prepare-idempotent: segunda pasada no altera output", () => {
    const input = loadGoldenFixture("03-prepare-idempotent", "in", "md");
    const expected = loadGoldenFixture("03-prepare-idempotent", "out", "md");
    const once = prepareMddMarkdownForPersist(input);
    const twice = prepareMddMarkdownForPersist(once);
    assertGoldenEqual(once, expected, "03-prepare-idempotent-once");
    assertGoldenEqual(twice, expected, "03-prepare-idempotent-twice");
  });

  it("04-english-headings: normalizeMddEnglishSubheadings", () => {
    const input = loadGoldenFixture("04-english-headings", "in", "md");
    const expected = loadGoldenFixture("04-english-headings", "out", "md");
    const actual = normalizeMddEnglishSubheadings(input);
    assertGoldenEqual(actual, expected, "04-english-headings");
  });

  it("05-seguridad-json: sanitizeSeguridadIntegracionRawJson", () => {
    const input = loadGoldenFixture("05-seguridad-json", "in", "md");
    const expected = loadGoldenFixture("05-seguridad-json", "out", "md");
    const actual = sanitizeSeguridadIntegracionRawJson(input);
    assertGoldenEqual(actual, expected, "05-seguridad-json");
  });

  it("regression: prepareMddMarkdownForPersist no reintroduce headings pegados", () => {
    const input = loadGoldenFixture("02-prepare-peel-hr", "in", "md");
    const out = prepareMddMarkdownForPersist(input);
    assert.doesNotMatch(out, /## 1\. Contexto ###/);
    assert.doesNotMatch(out, /--- --- ---/);
  });
});
