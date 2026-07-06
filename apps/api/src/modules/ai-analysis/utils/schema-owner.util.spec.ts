import { describe, it } from "node:test";
import assert from "node:assert";
import {
  composeSection3FromStructured,
  detectSection3CompositionBlockers,
} from "./schema-owner.util.js";
import { evaluateMddDeliveryGatePrepared } from "./mdd-delivery-gate-guard.util.js";

const PELUDO_BROKEN = `# Master Design Document

## 1. Contexto

Exportación con outbox.

## 2. Arquitectura y Stack

NestJS + PostgreSQL.

## 3. Modelo de Datos

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
application_id o NULL para system
\`\`\`

\`\`\`TechnicalMetadata
[high_security]
\`\`\`

## 4. Contratos de API

| POST | /events | Publicar |

\`\`\`json
{"x":1}
\`\`\`

## 5. Lógica y Edge Cases

Worker publica eventos pendientes.

## 6. Seguridad

Los intentos fallidos se registran en security_events.
Los refresh tokens rotativos se almacenan en refresh_tokens.
MFA TOTP obligatorio con totp_secret en usuarios.

## 7. Infraestructura

Lee la tabla eventos pendientes de publicar.
`;

const SECTION3_BLOCKER_RE =
  /§3|SQL|outbox|prosa inválida|security_events|refresh_tokens|mfa_backup|totp_secret|TechnicalMetadata/i;

describe("composeSection3FromStructured", () => {
  it("deduplica outbox Peludo (eventos canónico) y repara prosa SQL", () => {
    const out = composeSection3FromStructured(PELUDO_BROKEN);
    assert.ok(/CREATE\s+TABLE\s+eventos\b/i.test(out));
    assert.ok(!/CREATE\s+TABLE\s+outbox\s*\(/i.test(out));
    assert.ok(!/application_id o NULL para system/i.test(out));
    assert.ok(out.includes("erDiagram") || out.includes("EVENTOS"));
  });

  it("añade stubs §6 (security_events, refresh_tokens) y totp_secret en usuarios", () => {
    const draft = `${PELUDO_BROKEN.replace(
      "CREATE TABLE eventos",
      "CREATE TABLE usuarios (\n  id UUID PRIMARY KEY,\n  email TEXT NOT NULL\n);\nCREATE TABLE eventos",
    )}`;
    const out = composeSection3FromStructured(draft);
    assert.ok(/CREATE\s+TABLE\s+security_events\b/i.test(out));
    assert.ok(/CREATE\s+TABLE\s+refresh_tokens\b/i.test(out));
    assert.ok(/\btotp_secret\s+BYTEA\b/i.test(out));
  });

  it("no inyecta totp_secret cuando §6 indica sin MFA", () => {
    const draft = `${PELUDO_BROKEN.replace(
      "MFA TOTP obligatorio con totp_secret en usuarios.",
      "Autenticación JWT; sin MFA. Los intentos fallidos se registran en security_events.",
    ).replace(
      "CREATE TABLE eventos",
      "CREATE TABLE usuarios (\n  id UUID PRIMARY KEY,\n  email TEXT NOT NULL,\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\nCREATE TABLE eventos",
    )}`;
    const out = composeSection3FromStructured(draft);
    const userTable = out.match(/CREATE TABLE usuarios[\s\S]*?\);/i)?.[0] ?? "";
    assert.ok(!/\btotp_secret\b/i.test(userTable));
    assert.ok(!/updated_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)\s*,\s*\n\s*,/i.test(userTable));
  });

  it("reduce blockers §3 y mejora gate Peludo-like", async () => {
    const before = detectSection3CompositionBlockers(PELUDO_BROKEN);
    assert.ok(before.some((b) => b.includes("outbox-like duplicadas")));
    const composed = composeSection3FromStructured(PELUDO_BROKEN);
    const after = detectSection3CompositionBlockers(composed);
    assert.equal(after.some((b) => b.includes("outbox-like duplicadas")), false);
    assert.ok(!/CREATE\s+TABLE\s+outbox\s*\(/i.test(composed));
    assert.ok(/tabla\s+eventos\b/i.test(composed) || /Lee la tabla eventos/i.test(composed));
    const gate = await evaluateMddDeliveryGatePrepared(composed);
    assert.ok(gate.blockers.every((b) => !b.includes("outbox-like duplicadas")));
  });

  it("elimina outbox cuando eventos es canónico (procesado+payload_json)", () => {
    const draft = PELUDO_BROKEN.replace(
      "payload JSONB",
      "payload_json JSONB",
    ).replace(
      "CREATE TABLE outbox",
      "CREATE TABLE outbox",
    );
    const out = composeSection3FromStructured(draft);
    assert.ok(/CREATE\s+TABLE\s+eventos\b/i.test(out));
    assert.ok(!/CREATE\s+TABLE\s+outbox\s*\(/i.test(out));
  });
});

describe("detectSection3CompositionBlockers", () => {
  it("filtra issues no relacionados con §3", () => {
    const blockers = detectSection3CompositionBlockers(PELUDO_BROKEN);
    assert.ok(blockers.length > 0);
    assert.ok(blockers.every((b) => SECTION3_BLOCKER_RE.test(b)));
  });
});
