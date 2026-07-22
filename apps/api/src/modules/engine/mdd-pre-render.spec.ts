import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mermaidBlockHasUsableStructure,
  preRenderMddSanity,
  repairPrematureMermaidFenceClose,
  sanitizeMermaidBlock,
  sanitizeMermaidInDraft,
  validateMermaidSyntax,
} from "./mdd-pre-render.js";

describe("sanitizeMermaidBlock erDiagram PK/FK", () => {
  it("repara PK, FK con coma a un solo PK", () => {
    const raw = `erDiagram
  users {
    uuid user_id PK, FK
  }`;
    const out = sanitizeMermaidBlock(raw);
    assert.match(out, /user_id PK/);
    assert.doesNotMatch(out, /PK\s*,\s*FK/);
    assert.doesNotMatch(out, /\bPK\s+FK\b/i);
  });

  it("preRenderMddSanity acepta erDiagram reparado", () => {
    const draft = `# MDD

## 3. Modelo de Datos

\`\`\`mermaid
erDiagram
  agencies {
    uuid tenant_id PK, FK
    string name
  }
\`\`\`
`;
    assert.equal(preRenderMddSanity(draft).ok, true);
  });

  it("preRenderMddSanity acepta flowchart con subgraph", () => {
    const draft = `# MDD

## 2. Arquitectura

\`\`\`mermaid
flowchart TD
  subgraph fe_React["Frontend React"]
    UI[Panel] --> API[API Gateway]
  end
\`\`\`
`;
    assert.equal(preRenderMddSanity(draft).ok, true);
  });
});

describe("validateMermaidSyntax", () => {
  it("expone error distinto si falta tipo de diagrama", () => {
    const result = validateMermaidSyntax(`users {
  uuid id PK
}`);
    assert.equal(result.ok, false);
    assert.match(result.message ?? "", /Unknown diagram type|inválido/i);
  });
});

describe("sanitizeMermaidInDraft / premature fence", () => {
  it("mermaidBlockHasUsableStructure es false sin aristas", () => {
    assert.equal(
      mermaidBlockHasUsableStructure(`flowchart TB
  subgraph ACTORES["Actores"]
  end`),
      false,
    );
  });

  it("reensambla nodos ### ID[...] fuera del fence tras cierre prematuro", () => {
    const raw = `### 2.8 Diagrama

\`\`\`mermaid
flowchart TB
  subgraph ACTORES["Actores de negocio"]
  end
\`\`\`

### USR["Usuario Autorizado (WhatsApp)"]

### ADM["Superadmin / Tenant Admin (Panel Web)"]

  subgraph INFRA["Infraestructura AWS"]
  WAF["AWS WAF + ALB"]
  end

USR -->|"Mensajes"| WAF
`;
    const out = sanitizeMermaidInDraft(raw);
    assert.match(out, /```mermaid/);
    assert.match(out, /USR\["Usuario Autorizado/);
    assert.match(out, /USR\s*-->/);
    assert.doesNotMatch(out, /### USR\[/);
  });

  it("repairPrematureMermaidFenceClose demote headings a nodos", () => {
    const raw = `\`\`\`mermaid
flowchart TB
  A[Start]
\`\`\`

### B["Next"]

A --> B
`;
    const out = repairPrematureMermaidFenceClose(raw);
    assert.match(out, /B\["Next"\]/);
    assert.doesNotMatch(out, /### B\[/);
  });
});
