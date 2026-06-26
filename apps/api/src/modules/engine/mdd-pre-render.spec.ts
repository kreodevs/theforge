import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preRenderMddSanity,
  sanitizeMermaidBlock,
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
