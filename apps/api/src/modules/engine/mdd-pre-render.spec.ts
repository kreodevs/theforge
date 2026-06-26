import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  preRenderMddSanity,
  sanitizeMermaidBlock,
  validateMermaidSyntax,
} from "./mdd-pre-render.js";

describe("sanitizeMermaidBlock erDiagram PK/FK", () => {
  it("repara PK, FK con coma a PK FK", () => {
    const raw = `erDiagram
  users {
    uuid user_id PK, FK
  }`;
    const out = sanitizeMermaidBlock(raw);
    assert.match(out, /user_id PK FK/);
    assert.doesNotMatch(out, /PK\s*,\s*FK/);
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
    const sanity = preRenderMddSanity(draft);
    assert.equal(sanity.ok, true);
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
