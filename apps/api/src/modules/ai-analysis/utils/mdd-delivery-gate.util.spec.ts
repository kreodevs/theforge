import { describe, it } from "node:test";
import assert from "node:assert";
import {
  validateMddForDelivery,
  mddDeliveryGateHasBlockers,
  applyDeliveryGateToSemaphoreStatus,
  mddStreamDeliveryGateFields,
} from "./mdd-delivery-gate.util.js";
import { applyPreDeliveryGateFixes } from "./mdd-sanitize.js";

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

describe("validateMddForDelivery", () => {
  it("aprueba MDD canónico mínimo (score >= 90, sin blockers)", () => {
    const result = validateMddForDelivery(VALID_MDD);
    assert.equal(result.blockers.length, 0, result.blockers.join("; "));
    assert.ok(result.score >= 90, `score=${result.score}`);
    assert.equal(result.ok, true);
  });

  it("auto-alinea node:XX en §7 con §2 antes de validar (sin blocker Node)", () => {
    const draft = `# MDD

## 2. Arquitectura y Stack

| Capa | Tecnología | Versión |
| Backend | Node.js | 20 |

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API

| GET | /api/v1/health |

\`\`\`json
{"ok": true}
\`\`\`

## 5. Lógica y Edge Cases

Reglas.

## 6. Seguridad

JWT.

## 7. Infraestructura

\`\`\`json
{
  "stack": {
    "backend": {
      "container": { "base_image": "node:22-alpine", "exposed_port": 3000 }
    }
  }
}
\`\`\`
`;
    const result = validateMddForDelivery(draft);
    assert.ok(
      !result.blockers.some((b) => b.includes("versión Node distinta")),
      result.blockers.join("; "),
    );
  });

  it("bloquea prosa SQL pegada a DDL (Peludo)", () => {
    const draft = `## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY
);
-- comentario partido
  particionado por mes
application_id o NULL para system
\`\`\`

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API

| POST | /auth/login | Login |

\`\`\`json
{"a":1}
\`\`\`

## 6. Seguridad

Hash Argon2id.

## 7. Infraestructura

K8s.
`;
    const result = validateMddForDelivery(draft);
    assert.equal(result.ok, false);
    assert.ok(
      result.blockers.some((b) => b.includes("prosa inválida") || b.includes("Secciones obligatorias")),
    );
  });

  it("auto-repara o advierte outbox duplicado sin bloquear (Peludo)", () => {
    const draft = `## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE eventos (
  id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  procesado BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE outbox (
  id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ
);
\`\`\`

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API

| POST | /events | Publicar |

\`\`\`json
{"x":1}
\`\`\`

## 6. Seguridad

JWT.

## 7. Infraestructura

Lee la tabla eventos pendientes de publicar.
`;
    const result = validateMddForDelivery(draft);
    assert.equal(
      result.blockers.filter((b) => b.includes("outbox-like")).length,
      0,
      result.blockers.join("; "),
    );
  });

  it("advierte tablas §6 sin CREATE TABLE en §3 (security_events, refresh_tokens)", () => {
    const draft = `## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API

| POST | /auth/login | Login |

\`\`\`json
{"email":"a"}
\`\`\`

## 6. Seguridad

- Los intentos fallidos se registran en security_events.
- Los refresh tokens rotativos se almacenan en refresh_tokens.

## 7. Infraestructura

Docker.
`;
    const result = validateMddForDelivery(draft);
    assert.ok(
      result.warnings.some((b) => b.includes("security_events")),
      result.warnings.join("; "),
    );
    assert.ok(
      result.warnings.some((b) => b.includes("refresh_tokens")),
      result.warnings.join("; "),
    );
    assert.equal(
      result.blockers.filter((b) => /security_events|refresh_tokens/.test(b)).length,
      0,
    );
  });

  it("auto-repara bloque ```sql sin cerrar o advierte sin bloquear", () => {
    const draft = `${VALID_MDD.split("## 3. Modelo de Datos")[0]}## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);

### Diagrama entidad-relación

\`\`\`TechnicalMetadata
[high_security]
\`\`\`
${VALID_MDD.split("## 4. Contratos de API")[1]}`;
    const result = validateMddForDelivery(draft);
    assert.equal(
      result.blockers.filter((b) => b.includes("```sql sin cerrar")).length,
      0,
      result.blockers.join("; "),
    );
  });

  it("deduplica criterios UAT duplicados §1/§5 sin bloquear", () => {
    const uatBullets = `### Criterios UAT
- Login exitoso con credenciales válidas.
- Exportación rechazada sin aprobación dual.
- Auditoría registra cada intento fallido.`;
    const draft = VALID_MDD.replace(
      "## 1. Contexto\n\nProducto de exportación controlada con aprobación dual.",
      `## 1. Contexto\n\n${uatBullets}\n\nProducto de exportación controlada con aprobación dual.`,
    ).replace(
      "## 5. Lógica y Edge Cases\n\nDado un usuario autenticado cuando exporta entonces requiere aprobación dual.",
      `## 5. Lógica y Edge Cases\n\n${uatBullets}\n\nDado un usuario autenticado cuando exporta entonces requiere aprobación dual.`,
    );
    const fixed = applyPreDeliveryGateFixes(draft);
    assert.match(fixed, /Ver\s+§1/i);
    const result = validateMddForDelivery(draft);
    assert.equal(result.blockers.length, 0, result.blockers.join("; "));
  });

  it("mddDeliveryGateHasBlockers refleja blockers del gate", () => {
    assert.equal(mddDeliveryGateHasBlockers(VALID_MDD), false);
    assert.equal(mddDeliveryGateHasBlockers(""), true);
  });
});

describe("applyDeliveryGateToSemaphoreStatus", () => {
  it("degrada a rojo con blockers aunque el semáforo fuera verde", () => {
    const gate = validateMddForDelivery("# MDD\n\n## 1. Contexto\n\nSin secciones.");
    assert.ok(gate.blockers.length > 0);
    assert.equal(applyDeliveryGateToSemaphoreStatus("green", gate), "red");
  });

  it("degrada a amarillo con warnings sin blockers", () => {
    const gate = { ok: false, score: 85, blockers: [] as string[], warnings: ["Advertencia menor"] };
    assert.equal(applyDeliveryGateToSemaphoreStatus("green", gate), "yellow");
  });
});

describe("mddStreamDeliveryGateFields", () => {
  it("incluye deliveryGate en payload done cuando prepareMddForOutput validó el borrador", async () => {
    const { prepareMddForOutput } = await import("./mdd-prepare-output.js");
    const gateRef: { current?: ReturnType<typeof validateMddForDelivery> } = {};
    await prepareMddForOutput(VALID_MDD, { deliveryGateRef: gateRef });
    const fields = mddStreamDeliveryGateFields(gateRef.current, "green");
    assert.ok(fields.deliveryGate);
    assert.equal(fields.deliveryGate.ok, true);
    assert.equal(fields.status, "green");
  });

  it("done con MDD inválido expone deliveryGate y status rojo", () => {
    const gate = validateMddForDelivery("## 1. Contexto\n\nIncompleto.");
    const fields = mddStreamDeliveryGateFields(gate, "green");
    assert.equal(fields.deliveryGate?.ok, false);
    assert.equal(fields.status, "red");
    assert.ok((fields.deliveryGate?.blockers.length ?? 0) > 0);
  });
});
