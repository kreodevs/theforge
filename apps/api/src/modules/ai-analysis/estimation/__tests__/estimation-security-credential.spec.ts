import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EstimationService } from "../estimation.service.js";
import {
  ensureCredentialStorageInSection6,
  isCredentialStorageSatisfied,
  mergeSection6AvoidingRegression,
} from "../../utils/mdd-credential-storage.util.js";

const PELUDO_LIKE_MDD = `
## 1. Contexto y alcance

Sistema de gestión con autenticación por credenciales, sesiones JWT y control de acceso por roles.
Alcance MVP con login, refresh tokens y registro de eventos de seguridad para auditoría operativa.

## 2. Arquitectura y Stack

Backend NestJS, PostgreSQL, despliegue Docker.

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type VARCHAR(100) NOT NULL,
  ip_address INET,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
\`\`\`

## 4. Contratos de API

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | /api/v1/auth/login | Login con credenciales |

\`\`\`json
{ "email": "user@example.com", "password": "secret" }
\`\`\`

## 5. Lógica y Edge Cases

Flujos de login y refresh token documentados.

## 6. Seguridad

- Autenticación:
    - JWT RS256 con access token corto y refresh token rotativo.
    - Bloqueo tras 5 intentos fallidos consecutivos.

- Gestión de Secretos:
    - Secretos de aplicación en secrets manager (Vault).
    - Variables de entorno referencian claves del almacén; nunca valores en texto plano.
    - Eventos de login registrados en \`security_events\` (§3).

## 7. Infraestructura

Docker Compose, PostgreSQL, variables de entorno en despliegue.
`.trim();

describe("estimation seguridad — almacén de credenciales (Peludo-like)", () => {
  const service = new EstimationService(null as never);

  it("isCredentialStorageSatisfied con Gestión de Secretos + tablas §3", () => {
    assert.equal(isCredentialStorageSatisfied(PELUDO_LIKE_MDD), true);
  });

  it("getPrecisionBreakdown: seguridad 100% sin gap de almacén", () => {
    const breakdown = service.getPrecisionBreakdown(PELUDO_LIKE_MDD, { complexity: "HIGH" });
    assert.equal(breakdown.seguridad, 100);
    assert.equal(breakdown.sectionReasons?.seguridad, undefined);
  });

  it("pasa solo con security_events + refresh_tokens en §3 (sin gestión de secretos en §6)", () => {
    const md = PELUDO_LIKE_MDD.replace(
      /- Gestión de Secretos:[\s\S]*?(?=\n## 7\.)/,
      "",
    );
    assert.equal(isCredentialStorageSatisfied(md), true);
    const breakdown = service.getPrecisionBreakdown(md, { complexity: "HIGH" });
    assert.equal(breakdown.seguridad, 100);
  });

  it("ensureCredentialStorageInSection6 inyecta almacén cuando falta", () => {
    const sparse = PELUDO_LIKE_MDD.replace(
      /- Gestión de Secretos:[\s\S]*?(?=\n## 7\.)/,
      "",
    ).replace(/```sql[\s\S]*?```/, "```sql\nCREATE TABLE users (id UUID PRIMARY KEY);\n```");
    assert.equal(isCredentialStorageSatisfied(sparse), false);
    const patched = ensureCredentialStorageInSection6(sparse);
    assert.match(patched, /almac[eé]n de credenciales/i);
    assert.match(patched, /security_events/i);
    assert.equal(isCredentialStorageSatisfied(patched), true);
  });

  it("mergeSection6AvoidingRegression preserva Gestión de Secretos si el LLM acorta §6", () => {
    const shortened = `## 6. Seguridad

- Autenticación:
    - JWT RS256.
`;
    const merged = mergeSection6AvoidingRegression(PELUDO_LIKE_MDD, shortened);
    assert.match(merged, /Gestión de Secretos/i);
    assert.match(merged, /secrets manager/i);
    assert.ok(merged.length > shortened.length);
  });
});
