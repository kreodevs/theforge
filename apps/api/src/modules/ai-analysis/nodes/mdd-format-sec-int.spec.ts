import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMddFormatSecIntNode } from "./mdd-format-sec-int.node.js";
import { replaceSection6Or7InDraft, seguridadItemsToSection6Markdown } from "../utils/mdd-sanitize.js";
import { mddSeguridadItemSchema } from "../state/mdd-structured.schema.js";

const BASE_DRAFT = `# Master Design Document

## 1. Contexto

Contexto.

## 2. Arquitectura y Stack

Stack.

## 3. Modelo de Datos

\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API

Endpoints.

## 5. Lógica y Edge Cases

Lógica.

## 6. Seguridad

(Pendiente: Arquitecto de Seguridad)

## 7. Infraestructura

(Pendiente: Ingeniero de Integración)
`;

describe("createMddFormatSecIntNode", () => {
  const merge = createMddFormatSecIntNode();

  it("aplica §6 y §7 desde staging y limpia campos", () => {
    const seguridad = [
      mddSeguridadItemSchema.parse({
        title: "Autenticación",
        content: ["Argon2id para contraseñas.", "JWT con refresh rotativo."],
      }),
    ];
    const sec6Md = seguridadItemsToSection6Markdown(seguridad);
    const sec7Md = `## 7. Infraestructura

### Flujo de despliegue

Docker Compose con PostgreSQL y Redis.`;

    const result = merge({
      mddDraft: BASE_DRAFT,
      securitySectionMd: sec6Md,
      integrationSectionMd: sec7Md,
    } as Parameters<typeof merge>[0]);

    assert.ok(result.mddDraft?.includes("Argon2id"), "§6 sustancial debe estar en mddDraft");
    assert.ok(result.mddDraft?.includes("Docker Compose"), "§7 sustancial debe estar en mddDraft");
    assert.ok(!result.mddDraft?.includes("Pendiente: Arquitecto de Seguridad"));
    assert.ok(!result.mddDraft?.includes("Pendiente: Ingeniero de Integración"));
    assert.equal(result.securitySectionMd, undefined);
    assert.equal(result.integrationSectionMd, undefined);
    assert.ok(result.bestMddDraft?.includes("Argon2id"));
  });

  it("no-op cuando no hay staging", () => {
    const result = merge({ mddDraft: BASE_DRAFT } as Parameters<typeof merge>[0]);
    assert.deepEqual(result, {});
  });

  it("aplica solo §6 si falta §7 en staging", () => {
    const sec6Md = replaceSection6Or7InDraft("", 6, "## 6. Seguridad\n\nMFA TOTP obligatorio.");
    const result = merge({
      mddDraft: BASE_DRAFT,
      securitySectionMd: sec6Md,
    } as Parameters<typeof merge>[0]);

    assert.match(result.mddDraft ?? "", /MFA TOTP obligatorio/);
    assert.match(result.mddDraft ?? "", /Pendiente: Ingeniero de Integración/);
  });
});
