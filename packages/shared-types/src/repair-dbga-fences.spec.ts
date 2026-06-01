import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import { repairGluedSqlTokens, repairStackedCodeFences } from "./repair-pasted-markdown.js";

describe("repairStackedCodeFences", () => {
  it("quita fence vacío antes de json", () => {
    const raw = "**Response 200:**\n\n```\n```json\n{ \"status\": \"ok\" }\n```";
    const out = repairStackedCodeFences(raw);
    assert.doesNotMatch(out, /```\s*\n```json/);
    assert.match(out, /\*\*Response 200:\*\*\s*\n+```json/);
  });

  it("repara REFERENCES regiON estado en SQL", () => {
    const raw =
      "region_estado_id BIGINT NOT NULL REFERENCES regiON estado(id) ON DELETE CASCADE;";
    const glued = repairGluedSqlTokens(raw);
    assert.match(glued, /REFERENCES region_estado/);
    const out = formatDocumentMarkdown(raw);
    assert.match(out, /REFERENCES region_estado/);
  });

  it("quita llave suelta antes de bloques env del SSO", () => {
    const raw =
      "#### Variables de entorno\n}\n\n**Backend (NestJS):**\n\n```\n```env\nSSO_API_URL=x\n```";
    const out = formatDocumentMarkdown(raw);
    assert.doesNotMatch(out, /Variables de entorno\n\}/);
    assert.match(out, /\*\*Backend \(NestJS\):\*\*\s*\n+```env/);
  });

  it("une JWT partido en dos fences json", () => {
    const raw = [
      "```json",
      "{",
      '  "sub": "u1",',
      '  "applications": [',
      "```",
      "```json",
      "    {",
      '      "applicationId": "app1",',
      '      "roles": ["admin"]',
      "    }",
      "  ]",
      "}",
      "```",
    ].join("\n");
    const out = formatDocumentMarkdown(raw);
    assert.doesNotMatch(out, /```\s*\n```json\n\s*\{/);
    assert.match(out, /"applications":\s*\[\s*\{/);
  });
});
