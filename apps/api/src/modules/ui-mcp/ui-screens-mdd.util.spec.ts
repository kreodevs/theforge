import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractEntityNamesFromMdd,
  normalizeGluedSection3Headings,
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

describe("ui-screens-mdd — resolveConstitutionMarkdown", () => {
  it("prefiere mddContent del stage activo sobre specContent", () => {
    const md = resolveConstitutionMarkdown({
      complexity: "HIGH",
      specContent: "## 3. Modelo de Datos\n\nCREATE TABLE wrong (id int);",
      stages: [
        {
          ordinal: 1,
          workflowStatus: "ACTIVE",
          mddContent: "## 3. Modelo de Datos\n\nCREATE TABLE tenants (id UUID);",
        },
      ],
    });
    assert.match(md, /CREATE TABLE tenants/);
    assert.doesNotMatch(md, /CREATE TABLE wrong/);
  });
});
