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
