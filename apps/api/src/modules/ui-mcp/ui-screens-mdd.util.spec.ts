import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StageStatus } from "@theforge/database";
import {
  extractEntityKeyFieldsFromMdd,
  extractEntityNamesFromMdd,
  normalizeGluedSection3Headings,
  parseCreateTableKeyFields,
  pickKeyFieldsFromColumns,
  resolveConstitutionMarkdown,
} from "./ui-screens-mdd.util.js";

describe("ui-screens-mdd — normalizeGluedSection3Headings", () => {
  it("separa ### pegado al título de §3", () => {
    const raw = "## 3. Modelo de Datos### 3.1 Esquema\n\nCREATE TABLE tenants (id UUID);";
    const norm = normalizeGluedSection3Headings(raw);
    assert.match(norm, /Modelo de Datos\n\n### 3\.1/);
  });
});

describe("ui-screens-mdd — extractEntityNamesFromMdd", () => {
  it("extrae tablas de §3 con heading pegado y SQL sin fence", () => {
    const mdd = [
      "## 3. Modelo de Datos### 3.1 Esquema Relacional",
      "",
      "CREATE TABLE tenants (id UUID PRIMARY KEY);",
      "CREATE TABLE users (id UUID PRIMARY KEY, tenant_id UUID);",
    ].join("\n");
    assert.deepEqual(extractEntityNamesFromMdd(mdd), ["tenants", "users"]);
  });

  it("extrae tablas de bloque ```sql en §3", () => {
    const mdd = [
      "## 3. Modelo de Datos",
      "",
      "```sql",
      "CREATE TABLE orders (id UUID PRIMARY KEY);",
      "```",
    ].join("\n");
    assert.deepEqual(extractEntityNamesFromMdd(mdd), ["orders"]);
  });
});

describe("ui-screens-mdd — extractEntityKeyFieldsFromMdd", () => {
  it("extrae PK y campos semánticos por tabla", () => {
    const mdd = [
      "## 3. Modelo de Datos",
      "",
      "CREATE TABLE orders (",
      "  id UUID PRIMARY KEY,",
      "  status TEXT NOT NULL,",
      "  total NUMERIC NOT NULL,",
      "  notes TEXT",
      ");",
    ].join("\n");
    const map = extractEntityKeyFieldsFromMdd(mdd);
    assert.deepEqual(map.get("orders"), ["id", "status", "total", "notes"]);
  });

  it("fallback id cuando no hay columnas parseables", () => {
    const map = parseCreateTableKeyFields("CREATE TABLE empty ();");
    assert.deepEqual(map.get("empty"), ["id"]);
  });
});

describe("ui-screens-mdd — pickKeyFieldsFromColumns", () => {
  it("prioriza PK y status", () => {
    const fields = pickKeyFieldsFromColumns([
      { name: "created_at", pk: false },
      { name: "status", pk: false },
      { name: "id", pk: true },
    ]);
    assert.deepEqual(fields, ["id", "status", "created_at"]);
  });
});

describe("ui-screens-mdd — resolveConstitutionMarkdown", () => {
  it("prefiere mddContent del stage activo sobre specContent", () => {
    const md = resolveConstitutionMarkdown({
      complexity: "HIGH",
      specContent: "## 3. Modelo de Datos\n\nCREATE TABLE wrong (id int);",
      stages: [
        {
          ordinal: 1,
          workflowStatus: StageStatus.ACTIVE,
          mddContent: "## 3. Modelo de Datos\n\nCREATE TABLE tenants (id UUID);",
        },
      ],
    });
    assert.match(md, /CREATE TABLE tenants/);
    assert.doesNotMatch(md, /CREATE TABLE wrong/);
  });
});
