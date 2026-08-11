import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  injectMddDiagrams,
  regenerateErDiagramFromSql,
  sqlToErDiagramContent,
  suggestMddDiagrams,
  wrapErDiagramAsMermaidFence,
} from "./mdd-diagram-suggestions.js";
import { extractPaso0DecisionCatalog } from "../phase0/paso0-pasted-definitive.util.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const paso0Catalog = extractPaso0DecisionCatalog(readFileSync(join(repoRoot, "STEP_0-review.md"), "utf8"));

const sampleSql = `CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL
);
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL
);`;

describe("sqlToErDiagramContent", () => {
  it("genera erDiagram válido desde REFERENCES", () => {
    const out = sqlToErDiagramContent(sampleSql);
    assert.ok(out);
    assert.match(out!, /^erDiagram/);
    assert.doesNotMatch(out!, /uuid default/i);
    assert.match(out!, /tenants \|\|--o\{ tenant_users/);
    assert.match(out!, /: "tenant"/);
  });

  it("no emite PK FK cuando la columna es PK y FK", () => {
    const sql = `CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id)
);`;
    const out = sqlToErDiagramContent(sql);
    assert.ok(out);
    assert.doesNotMatch(out!, /\bPK\s+FK\b/i);
    assert.match(out!, /uuid id PK/);
  });
});

describe("wrapErDiagramAsMermaidFence", () => {
  it("no duplica encabezado erDiagram", () => {
    const inner = sqlToErDiagramContent(sampleSql)!;
    const fence = wrapErDiagramAsMermaidFence(inner);
    assert.match(fence, /^```mermaid\nerDiagram/);
    assert.doesNotMatch(fence, /erDiagram\s*\nerDiagram/);
  });
});

describe("injectMddDiagrams — reemplaza erDiagram del LLM", () => {
  it("pisa diagrama roto del LLM con uno derivado del SQL", () => {
    const draft = `## 3. Modelo de Datos

\`\`\`sql
${sampleSql}
\`\`\`

### Diagrama entidad-relación

\`\`\`mermaid
erDiagram
  tenants {
    uuid id PK
    uuid default FK
    string name FK
  }
  tenant_users ||--o{ campaigns : "name"
\`\`\`

## 4. Contratos de API`;

    const suggestions = suggestMddDiagrams(draft);
    const out = injectMddDiagrams(draft, suggestions);
    assert.doesNotMatch(out, /uuid default/i);
    assert.match(out, /tenants \|\|--o\{ tenant_users/);
    assert.doesNotMatch(out, /campaigns : "name"/);
  });
});

describe("regenerateErDiagramFromSql", () => {
  it("inserta diagrama cuando falta", () => {
    const draft = `## 3. Modelo de Datos

\`\`\`sql
${sampleSql}
\`\`\`

## 4. Contratos de API`;
    const out = regenerateErDiagramFromSql(draft);
    assert.ok(out);
    assert.match(out!, /```mermaid[\s\S]*erDiagram[\s\S]*```/);
  });
});

describe("sqlToErDiagramContent con catálogo Paso 0", () => {
  it("excluye entidades prohibidas/inventadas del erDiagram", () => {
    assert.ok(paso0Catalog);
    const sql = `
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
CREATE TABLE llm_configs (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
`;
    const out = sqlToErDiagramContent(sql, { paso0Catalog: paso0Catalog! });
    assert.ok(out);
    assert.doesNotMatch(out!, /\bchannels\b/i);
    assert.doesNotMatch(out!, /\bllm_configs\b/i);
    assert.match(out!, /\bcontexts\b/i);
    assert.match(out!, /\bmessages\b/i);
    assert.match(out!, /\busers\b/i);
  });

  it("regenerateErDiagramFromSql respeta catálogo Paso 0", () => {
    assert.ok(paso0Catalog);
    const draft = `## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE agent_runs (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API`;
    const out = regenerateErDiagramFromSql(draft, { paso0Catalog: paso0Catalog! });
    assert.ok(out);
    const erBlock = out!.match(/```mermaid[\s\S]*?```/)?.[0] ?? "";
    assert.ok(erBlock.length > 0);
    assert.doesNotMatch(erBlock, /\bchannels\b/i);
    assert.doesNotMatch(erBlock, /\bagent_runs\b/i);
    assert.match(erBlock, /\bcontexts\b/i);
  });
});
