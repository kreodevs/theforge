import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  parseJsonOrThrowWithMeta,
  parseJsonText,
  repairInvalidJsonEscapes,
} from "./parse-json.js";

describe("repairInvalidJsonEscapes", () => {
  it("repairs Windows paths with invalid \\U escape", () => {
    const broken = '{"path":"C:\\Users\\dev\\app"}';
    const repaired = repairInvalidJsonEscapes(broken);
    assert.equal(repaired, '{"path":"C:\\\\Users\\\\dev\\\\app"}');
    const parsed = JSON.parse(repaired) as { path: string };
    assert.equal(parsed.path, "C:\\Users\\dev\\app");
  });

  it("repairs regex-like \\d inside JSON strings", () => {
    const broken = '{"pattern":"\\d+","sql":"WHERE id \\> 0"}';
    const repaired = repairInvalidJsonEscapes(broken);
    const parsed = JSON.parse(repaired) as { pattern: string; sql: string };
    assert.equal(parsed.pattern, "\\d+");
    assert.equal(parsed.sql, "WHERE id \\> 0");
  });

  it("leaves valid JSON escapes unchanged", () => {
    const valid = '{"msg":"line1\\nline2","quote":"\\"ok\\"","slash":"a\\/b"}';
    assert.equal(repairInvalidJsonEscapes(valid), valid);
    assert.deepEqual(JSON.parse(valid), JSON.parse(repairInvalidJsonEscapes(valid)));
  });

  it("preserves valid \\uXXXX unicode escapes", () => {
    const valid = '{"char":"\\u0041"}';
    assert.equal(repairInvalidJsonEscapes(valid), valid);
    assert.equal((JSON.parse(valid) as { char: string }).char, "A");
  });

  it("repairs truncated \\u escapes", () => {
    const broken = '{"bad":"\\u00"}';
    const repaired = repairInvalidJsonEscapes(broken);
    const parsed = JSON.parse(repaired) as { bad: string };
    assert.equal(parsed.bad, "\\u00");
  });

  it("repairs trailing backslash at end of string", () => {
    const broken = "{\"tail\":\"ends with \\" + "\\" + "\"}";
    const repaired = repairInvalidJsonEscapes(broken);
    const parsed = JSON.parse(repaired) as { tail: string };
    assert.equal(parsed.tail, "ends with \\");
  });
});

describe("parseJsonText", () => {
  const clarifierSchema = z.object({
    clarifiedScope: z.string(),
    contextoAlcance: z.string(),
  });

  it("parses clarifier-like payload after escape repair without LLM retry", () => {
    const mddSnippet =
      "## 2. Modelo de datos\\n\\n```sql\\nCREATE TABLE users (id uuid);\\n```\\n\\nPath: C:\\\\data\\\\dump";
    const broken = JSON.stringify({
      clarifiedScope: "**Entidades:** users",
      contextoAlcance: mddSnippet.replace(/\\\\/g, "\\"),
    }).replace(/\\\\/g, "\\");

    const { value, escapeRepaired } = parseJsonText(broken, { repairEscapes: true });
    assert.equal(escapeRepaired, true);
    const parsed = clarifierSchema.parse(value);
    assert.match(parsed.contextoAlcance, /CREATE TABLE users/);
    assert.match(parsed.contextoAlcance, /C:\\data\\dump/);
  });

  it("parseJsonOrThrowWithMeta reports escapeRepaired=false for valid JSON", () => {
    const text = '{"clarifiedScope":"ok","contextoAlcance":"contexto largo suficiente"}';
    const { value, escapeRepaired } = parseJsonOrThrowWithMeta(text, clarifierSchema, {
      repairEscapes: true,
    });
    assert.equal(escapeRepaired, false);
    assert.equal(value.clarifiedScope, "ok");
  });
});
