import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { repairMarkdownFences } from "./markdown-repair.js";
import { normalizeMermaidDiagramBody } from "./mermaid.js";

describe("repairMarkdownFences — unclosed mermaid erDiagram", () => {
  it("cierra fence y no desenvuelve cuando el resto del MDD quedó colado", () => {
    const doc = `## 3. Modelo de Datos

### Diagrama entidad-relación

\`\`\`mermaid
erDiagram
  tenants {
    uuid id PK
    uuid default
    string name
  }
  tenants ||--o{ tenant_users : "id"

## 4. Contratos de API

| Método | Ruta |
|--------|------|
| GET | /api/x |`;

    const out = repairMarkdownFences(doc);
    assert.match(out, /```mermaid[\s\S]*erDiagram[\s\S]*```/);
    assert.match(out, /## 4\. Contratos de API/);
    assert.doesNotMatch(out, /```mermaid[\s\S]*## 4\./);
    const norm = normalizeMermaidDiagramBody(
      out.match(/```mermaid\n([\s\S]*?)```/)?.[1] ?? "",
    );
    assert.doesNotMatch(norm, /uuid default/i);
    assert.match(norm, /tenants \|\|--o\{/);
  });
});
