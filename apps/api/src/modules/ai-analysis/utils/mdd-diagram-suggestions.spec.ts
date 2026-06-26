import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  injectMddDiagrams,
  regenerateErDiagramFromSql,
  sqlToErDiagramContent,
  suggestMddDiagrams,
  wrapErDiagramAsMermaidFence,
} from "./mdd-diagram-suggestions.js";

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
