import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIntegrationSpecVsMdd } from "./conformance.service.js";

const MDD_NO_INTEGRATIONS = `# Master Design Document

## 1. Contexto
Sistema interno de gestión. Sin sistemas colindantes ni APIs externas.

## 4. Contratos API
| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | /health | Health check interno |

## 7. Infraestructura
Despliegue estándar en Docker.
`;

const MDD_WITH_INTEGRATIONS = `# Master Design Document

## 1. Contexto
Integración con **SSO Corporativo** y webhook de **ERP Acme**.

## 4.B Integraciones externas
- POST /hooks/catalogo webhook catálogo hacia ERP Acme

## 7. Infraestructura y integración
### Flujo de integración catálogo
Webhook entrante desde ERP.
### Resiliencia
Circuit breaker hacia ERP.
`;

const ISD_MINIMAL_NA = `# Integration Spec

## 0. Metadata
Sin integraciones externas.

## 8. Cumplimiento con el MDD
| Ítem | Sección | Estado |
| --- | --- | --- |
| Integraciones | N/A | No aplica ☑ |

---FIN_INTEGRATION_SPEC---
`;

const ISD_OVERGENERATED = `# Integration Spec

## 1. Mapa de sistemas
Inventario extenso de **SSO Fantasma** y **ERP Inventado** con doc largo repetido.
${"Lorem ipsum integración externa detallada. ".repeat(40)}

## 3. Contratos por frontera
### SSO Fantasma
REST sync.

## 4. Secuencias de integración
\`\`\`mermaid
sequenceDiagram
  A->>B: call
\`\`\`

## 6. Resiliencia por frontera
| Sistema | timeout |
| --- | --- |
| SSO | 5s |

---FIN_INTEGRATION_SPEC---
`;

test("N/A: MDD sin §4.B ni colindantes → ISD mínimo pasa", () => {
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, ISD_MINIMAL_NA);
  assert.equal(result.ok, true);
  assert.deepEqual(result.gaps, []);
});

test("N/A: MDD sin integraciones → ISD largo falla (sobre-generación)", () => {
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, ISD_OVERGENERATED);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((g) => /sobre-generación/i.test(g)));
});

test("con integraciones: falta ISD devuelve gap", () => {
  const result = checkIntegrationSpecVsMdd(MDD_WITH_INTEGRATIONS, null);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.length > 0);
});

test("con integraciones: ISD cubre sistemas nombrados en MDD", () => {
  const isd = `# Integration Spec

## 1. Mapa de sistemas
**SSO Corporativo** entrante identidad.
**ERP Acme** webhook saliente.
POST /hooks/catalogo hacia ERP.

## 3. Contratos por frontera
### ERP Acme
POST /hooks/catalogo webhook catálogo hacia ERP Acme.

## 4. Secuencias de integración
Flujo de integración catálogo vía webhook.
\`\`\`mermaid
sequenceDiagram
  ERP->>App: webhook
\`\`\`

## 6. Resiliencia por frontera
| Sistema | timeout | circuit breaker |
| --- | --- | --- |
| ERP Acme | 5s | sí |

## 8. Cumplimiento
| x | y | ☑ |

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_WITH_INTEGRATIONS, isd);
  assert.equal(result.ok, true, result.gaps.join("; "));
});

test("formato: número impar de fences → gap sin balancear", () => {
  const isd = `# Integration Spec

## 4. Secuencias
\`\`\`mermaid
sequenceDiagram
  A->>B: call
\`\`\`
\`\`\`json
{ "open": true }

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((g) => /sin balancear/i.test(g)));
});

test("formato: fence fusionado con texto → gap fusionado", () => {
  const isd = `# Integration Spec

## 4. Secuencias
texto\`\`\`mermaid
sequenceDiagram
  A->>B: call
\`\`\`

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((g) => /fusionado/i.test(g)));
});

test("formato: ISD mínimo N/A sin fences sigue pasando", () => {
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, ISD_MINIMAL_NA);
  assert.equal(result.ok, true);
  assert.ok(!result.gaps.some((g) => /Formato:/i.test(g)));
});

test("formato: encabezado dentro de fence abierto → gap heading-in-fence", () => {
  const isd = `# Integration Spec

## 4. Secuencias
\`\`\`mermaid
sequenceDiagram
  A->>B: call
### 4.2 Título de flujo SIEM
  B->>C: fail
\`\`\`

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((g) => /encabezado dentro de bloque de código/i.test(g)));
});

test("formato: fences pares y encabezados fuera de fences → sin gaps de formato", () => {
  const isd = `# Integration Spec

## 4. Secuencias
### 4.1 Flujo A
\`\`\`mermaid
sequenceDiagram
  A->>B: call
\`\`\`

### 4.2 Flujo B
\`\`\`mermaid
sequenceDiagram
  B->>C: call
\`\`\`

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.ok(!result.gaps.some((g) => /Formato:/i.test(g)), result.gaps.join("; "));
});

test("formato: encabezado con token mermaid fusionado → gap #7c", () => {
  const isd = `# Integration Spec

## 4. Secuencias
### 4.2 Autenticación de aplicación corporativa (OAuth2 client_credentials)mermaid
sequenceDiagram
  A->>B: call

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.equal(result.ok, false);
  assert.ok(
    result.gaps.some((g) => /posible delimitador de código fusionado/i.test(g)),
  );
});

test("formato: encabezado legítimo que termina en palabra mermaid → sin gap #7c", () => {
  const isd = `# Integration Spec

## 4. Secuencias
### 4.2 Flujo documentado en mermaid

Texto descriptivo del flujo.

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.ok(
    !result.gaps.some((g) => /posible delimitador de código fusionado/i.test(g)),
    result.gaps.join("; "),
  );
});

test("formato: fence impar + encabezado tragado + token fusionado → todos los gaps", () => {
  const isd = `# Integration Spec

## 4. Secuencias
\`\`\`mermaid
sequenceDiagram
  A->>B: call
### 4.2 Título tragado
  B->>C: fail

### 4.3 OAuth (client_credentials)mermaid
sequenceDiagram
  X->>Y: z

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((g) => /encabezado dentro de bloque de código/i.test(g)));
  assert.ok(result.gaps.some((g) => /sin balancear/i.test(g)));
  assert.ok(result.gaps.some((g) => /posible delimitador de código fusionado/i.test(g)));
});

test("formato: fence impar + encabezado tragado → ambos gaps", () => {
  const isd = `# Integration Spec

## 4. Secuencias
\`\`\`mermaid
sequenceDiagram
  A->>B: call
### 4.2 Título tragado
  B->>C: fail

---FIN_INTEGRATION_SPEC---
`;
  const result = checkIntegrationSpecVsMdd(MDD_NO_INTEGRATIONS, isd);
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((g) => /encabezado dentro de bloque de código/i.test(g)));
  assert.ok(result.gaps.some((g) => /sin balancear/i.test(g)));
});
