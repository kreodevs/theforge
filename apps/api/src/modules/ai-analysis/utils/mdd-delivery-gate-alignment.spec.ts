import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateMddForDelivery } from "./mdd-delivery-gate.util.js";
import { evaluateMddQualityGate, qualityGateToDeliveryGate } from "./mdd-quality-gate.util.js";

const VALID_MDD = `# Master Design Document

## 1. Contexto

Producto de exportación controlada con aprobación dual.

## 2. Arquitectura y Stack

NestJS con PostgreSQL 16.

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL
);
CREATE TABLE security_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
\`\`\`

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API

| POST | /auth/login | Inicio de sesión |

\`\`\`json
{ "email": "user@example.com", "password": "secret" }
\`\`\`

\`\`\`json
{ "accessToken": "jwt", "refreshToken": "rt" }
\`\`\`

## 5. Lógica y Edge Cases

Dado un usuario autenticado cuando exporta entonces requiere aprobación dual.

## 6. Seguridad

Argon2id para bootstrap; intentos fallidos en security_events.

## 7. Infraestructura

Docker Compose con PostgreSQL.
`;

describe("delivery gate aligned with quality gate", () => {
  it("validateMddForDelivery ok coincide con quality gate cuando no hay blockers", () => {
    const qg = evaluateMddQualityGate(VALID_MDD);
    const dg = validateMddForDelivery(VALID_MDD);
    assert.equal(qg.ok, true);
    assert.equal(dg.ok, qg.ok);
    assert.equal(qualityGateToDeliveryGate(qg).ok, true);
  });

  it("UAT duplicado §1/§5 no bloquea delivery gate (dedupe sin warning)", () => {
    const uatBullets = `### Criterios UAT
- Login exitoso con credenciales válidas.
- Exportación rechazada sin aprobación dual.`;
    const draft = VALID_MDD.replace(
      "## 1. Contexto\n\nProducto de exportación controlada con aprobación dual.",
      `## 1. Contexto\n\n${uatBullets}\n\nProducto de exportación controlada con aprobación dual.`,
    ).replace(
      "## 5. Lógica y Edge Cases\n\nDado un usuario autenticado cuando exporta entonces requiere aprobación dual.",
      `## 5. Lógica y Edge Cases\n\n${uatBullets}\n\nDado un usuario autenticado cuando exporta entonces requiere aprobación dual.`,
    );
    const qg = evaluateMddQualityGate(draft);
    const dg = validateMddForDelivery(draft);
    assert.equal(qg.ok, true);
    assert.equal(dg.ok, true);
    assert.equal(
      dg.warnings.some((w) => w.includes("UAT")),
      false,
      "UAT idéntico en §1 y §5 se deduplica sin warning",
    );
  });
});
