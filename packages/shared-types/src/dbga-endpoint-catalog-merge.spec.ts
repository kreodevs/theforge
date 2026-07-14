import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeApiEndpointCatalogIntoDbga,
  stripTrailingDuplicateDbga,
} from "./dbga-endpoint-catalog-merge.js";

const ENDPOINTS = `Aquí tienes la lista simplificada de los endpoints esenciales:
1. Gestión de Sesión
POST /v1/chats — Crea una nueva sesión.
GET /v1/chats/{chat_id} — Historial.
DELETE /v1/chats/{chat_id} — Cierra.
2. Mensajería
POST /v1/chats/{chat_id}/messages
POST /v1/chats/{chat_id}/messages/stream
3. Estado
GET /v1/chats/{chat_id}/status
POST /v1/chats/{chat_id}/stop`;

describe("stripTrailingDuplicateDbga", () => {
  it("corta el segundo # Domain Benchmark tras ---", () => {
    const raw = `# Domain Benchmark & Gap Analysis

## 1. Propósito y Alcance

Texto completo.

## Registro de cambios del documento

| Versión | Fecha | Descripción del cambio |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Creación |

---

# Domain Benchmark & Gap Analysis

## 1. Propósito y Alcance

Texto truncado a medi`;
    const out = stripTrailingDuplicateDbga(raw);
    assert.equal((out.match(/^# Domain Benchmark/gm) ?? []).length, 1);
    assert.ok(out.includes("Texto completo"));
    assert.equal(out.includes("Texto truncado"), false);
  });
});

describe("mergeApiEndpointCatalogIntoDbga", () => {
  it("añade §11, cierra pregunta pendiente y changelog sin duplicar el título", () => {
    const current = `# Domain Benchmark & Gap Analysis

## Referencia de Industria

Proveedores.

## 1. Propósito y Alcance

Ver Sección 11.

## 10. Preguntas Pendientes

- ¿Qué endpoints específicos debe exponer la API para integración con el chat externo? (enviar mensaje, recibir respuesta, estado conversación)
- ¿Se requiere rate limiting por usuario?

## Registro de cambios del documento

| Versión | Fecha | Descripción del cambio |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Creación inicial |
| 1.22 | Junio 2026 | SSO copiloto-ia |`;

    const out = mergeApiEndpointCatalogIntoDbga(current, ENDPOINTS);
    assert.equal((out.match(/^# Domain Benchmark/gm) ?? []).length, 1);
    assert.ok(out.includes("## 11. API de Integración con Chat Externo"));
    assert.ok(out.includes("POST /v1/chats/{chat_id}/messages/stream"));
    assert.ok(/\*\*Respuesta:\*\*.*11\. API/i.test(out));
    assert.ok(out.includes("| 1.23 |"));
    assert.ok(out.includes("1.22"));
    assert.equal(out.includes("\n---\n\n# Domain Benchmark"), false);
  });

  it("dedupea DBGA concatenado y luego inserta endpoints", () => {
    const current = `# Domain Benchmark & Gap Analysis

## 1. Propósito y Alcance

Cuerpo A largo suficiente.

## 10. Preguntas Pendientes

- ¿Qué endpoints específicos debe exponer la API para integración con el chat externo?

## Registro de cambios del documento

| Versión | Fecha | Descripción del cambio |
| --- | --- | --- |
| 1.0 | Mayo 2026 | Creación |

---

# Domain Benchmark & Gap Analysis

## 1. Propósito y Alcance

Cuerpo B truncado`;

    const out = mergeApiEndpointCatalogIntoDbga(current, ENDPOINTS);
    assert.equal((out.match(/^# Domain Benchmark/gm) ?? []).length, 1);
    assert.ok(out.includes("/v1/chats"));
    assert.ok(out.includes("## 11."));
  });
});
