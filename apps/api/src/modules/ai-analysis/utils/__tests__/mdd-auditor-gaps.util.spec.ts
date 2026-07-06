import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDeterministicAuditorScore,
  synthesizeDeterministicAuditorGaps,
} from "../mdd-auditor-gaps.util.js";
import { validateMddStructure } from "../mdd-sanitize.js";

const minimalValidMdd = () => `
## 1. Contexto
Sistema de gestión.

## 2. Arquitectura y Stack
NestJS y PostgreSQL.

## 3. Modelo de Datos
TechnicalMetadata [high_security]
\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY, email VARCHAR(255));
\`\`\`
\`\`\`mermaid
erDiagram
  users {
    uuid id PK
    varchar email
  }
\`\`\`

## 4. Contratos de API
| Método | Ruta |
| GET | /users |
### GET /users
\`\`\`json
{"items": []}
\`\`\`

## 5. Lógica y Edge Cases
Reglas.

## 6. Seguridad
Auth JWT.

## 7. Infraestructura
Dockerfile FROM node:20
`.trim();

describe("mdd-auditor-gaps util", () => {
  it("synthesizeDeterministicAuditorGaps incluye gaps estructurados cuando faltan secciones", () => {
    const draft = "## 1. Contexto\nAlgo.";
    const validation = validateMddStructure(draft);
    const score = computeDeterministicAuditorScore(draft, validation);
    const gaps = synthesizeDeterministicAuditorGaps(draft, validation, score);
    assert.ok(gaps.critical_gaps.length > 0);
    assert.equal(gaps.status, "RECHAZADO");
  });

  it("MDD válido determinístico tiene menos gaps que borrador incompleto", () => {
    const draft = minimalValidMdd();
    const validation = validateMddStructure(draft);
    const gaps = synthesizeDeterministicAuditorGaps(
      draft,
      validation,
      computeDeterministicAuditorScore(draft, validation),
    );
    const badGaps = synthesizeDeterministicAuditorGaps(
      "## 1. Contexto\nAlgo.",
      validateMddStructure("## 1. Contexto\nAlgo."),
      40,
    );
    assert.ok(badGaps.critical_gaps.length > gaps.critical_gaps.length);
  });
});
