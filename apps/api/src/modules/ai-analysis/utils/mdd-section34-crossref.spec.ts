import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectSection34CrossRefGaps,
  extractJsonFieldPaths,
  parseSqlTableColumns,
} from "./mdd-section34-crossref.js";

describe("parseSqlTableColumns", () => {
  it("extrae tablas y columnas de CREATE TABLE", () => {
    const sql = `
CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL);
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  value_encrypted BYTEA NOT NULL
);
`;
    const tables = parseSqlTableColumns(sql);
    assert.ok(tables.has("users"));
    assert.ok(tables.get("users")!.has("email"));
    assert.ok(tables.get("api_keys")!.has("value_encrypted"));
  });
});

describe("detectSection34CrossRefGaps", () => {
  const draftWithGap = `# Master Design Document

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE api_keys (id UUID PRIMARY KEY, user_id UUID NOT NULL);
\`\`\`

## 4. Contratos de API

### GET /api/keys

**Response 200:**
\`\`\`json
{
  "id": "uuid",
  "value_encrypted": "string"
}
\`\`\`
`;

  it("detecta campo en JSON §4 sin columna en §3", () => {
    const gaps = detectSection34CrossRefGaps(draftWithGap);
    assert.ok(gaps.some((g) => g.field === "value_encrypted"));
  });

  it("ignora campos id estándar en respuestas", () => {
    const gaps = detectSection34CrossRefGaps(draftWithGap);
    assert.ok(!gaps.some((g) => g.field === "id"));
  });

  it("devuelve vacío si §3 o §4 faltan", () => {
    assert.deepEqual(detectSection34CrossRefGaps("## 1. Contexto\n\nSolo contexto."), []);
  });
});

describe("extractJsonFieldPaths", () => {
  it("recorre objetos anidados", () => {
    const body = `\`\`\`json
{ "user": { "profile": { "display_name": "x" } } }
\`\`\``;
    const paths = extractJsonFieldPaths(body);
    assert.ok(paths.some((p) => p.jsonPath === "user.profile.display_name"));
  });
});
