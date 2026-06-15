import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAsIsSection2BodyFromCodebaseDoc,
  buildAsIsSection3BodyFromCodebaseDoc,
  injectAsIsCodebaseEvidenceIntoMdd,
  stripEntitySummaryPlaceholders,
  stripServiceSummaryPlaceholders,
} from "./legacy-as-is-mdd-inject.util.js";

const ERP_SNIPPET = `
## Repositorio: desarrollo_imj/erp

### Resumen
Backend Strapi con content-types de campañas y cotizador.

### Entidades y modelo de datos
| Entidad | Origen | Atributos (muestra) |
| --- | --- | --- |
| campania | strapi | uid:api::campania.campania |
| pauta | strapi | uid:api::pauta.pauta |
| cotizador | strapi | uid:api::cotizador.cotizador |

### Contratos API
| Ruta | Métodos | Fuente |
| --- | --- | --- |
| /campanias | GET, POST | strapi |

### Lógica de negocio
| Servicio | Dependencias (paths) |
| --- | --- |
| strapi:campania | src/api/campania/services/campania.js |
| strapi:pauta | src/api/pauta/services/pauta.js |
| strapi:cotizador | src/api/cotizador/services/cotizador.js |
| strapi:agencia | src/api/agencia/services/agencia.js |

### Infraestructura
\`\`\`json
{ "orm": "strapi", "env_vars": ["DATABASE_URL", "REDIS_URL"] }
\`\`\`
`;

const OOH_SNIPPET = `
## Repositorio: desarrollo_imj/oohbp2

### Resumen
SPA React consumiendo API Strapi.

### Entidades y modelo de datos
| Entidad | Origen | Atributos (muestra) |
| --- | --- | --- |
| CampaniaModel | frontend | path:src/Models/CampaniaModel.tsx |

### Contratos API
| Ruta | Métodos | Fuente |
| --- | --- | --- |
| /api/campanias | GET | ast |

### Lógica de negocio
| Servicio | Dependencias (paths) |
| --- | --- |
| frontend:CampaniaQuerys | src/api/CampaniaQuerys.tsx |

### Infraestructura
\`\`\`json
{ "orm": "none", "env_vars": ["VITE_API_URL"] }
\`\`\`

### Rutas de evidencia
- \`package.json\`
- \`src/Models/CampaniaModel.tsx\`
`;

describe("buildAsIsSection2BodyFromCodebaseDoc", () => {
  it("describe Strapi + React desde índice, sin Laravel/Vue inventados", () => {
    const body = buildAsIsSection2BodyFromCodebaseDoc(ERP_SNIPPET + OOH_SNIPPET);
    assert.ok(body);
    assert.match(body!, /Strapi CMS/i);
    assert.match(body!, /React SPA/i);
    assert.match(body!, /desarrollo_imj\/erp/);
    assert.match(body!, /desarrollo_imj\/oohbp2/);
    assert.doesNotMatch(body!, /PHP 8\.1 \+ Laravel/i);
    assert.doesNotMatch(body!, /Vue 3 \+ Inertia/i);
    assert.match(body!, /Prohibido.*Laravel/i);
  });
});

describe("buildAsIsSection3BodyFromCodebaseDoc", () => {
  it("incluye tablas de todos los repos", () => {
    const body = buildAsIsSection3BodyFromCodebaseDoc(ERP_SNIPPET + OOH_SNIPPET);
    assert.ok(body);
    assert.match(body!, /campania/);
    assert.match(body!, /pauta/);
    assert.match(body!, /cotizador/);
    assert.match(body!, /CampaniaModel/);
    assert.match(body!, /Prohibido.*adicionales/i);
  });
});

describe("stripEntitySummaryPlaceholders", () => {
  it("elimina bloques de resumen LLM", () => {
    const raw =
      "### Dominio campañas\n\nTabla principal.\n\nOtras entidades significativas (60+ adicionales)\n\npauta, cotizador, ruta.";
    const out = stripEntitySummaryPlaceholders(raw);
    assert.doesNotMatch(out, /Otras entidades significativas/i);
    assert.doesNotMatch(out, /60\+ adicionales/i);
    assert.match(out, /Dominio campañas/);
  });
});

describe("stripServiceSummaryPlaceholders", () => {
  it("elimina listas resumidas de servicios Strapi", () => {
    const raw =
      "### Servicios de backend (Strapi)\n\n| campania | path | CRUD |\n\n(Además, servicios para cada Content Type restante: agencia, cotizador, pauta)";
    const out = stripServiceSummaryPlaceholders(raw);
    assert.doesNotMatch(out, /Además,\s*servicios/i);
    assert.match(out, /Servicios de backend/);
  });
});

describe("injectAsIsCodebaseEvidenceIntoMdd", () => {
  it("reemplaza §2 alucinado y §3–§5 resumidos por evidencia del codebaseDoc", () => {
    const mdd = `## 1. Contexto

Sistema OBP.

## 2. Arquitectura y Stack

| Backend ERP | PHP 8.1 + Laravel 10 | desarrollo_imj/erp |
| Frontend OOHBP2 | Vue 3 + Inertia | desarrollo_imj/oohbp2 |

### Diagrama de Componentes

\`\`\`mermaid
flowchart TB
  FE[Vue SPA]
\`\`\`

## 3. Modelo de Datos

Otras entidades significativas (60+ adicionales)

pauta, cotizador, concepto-cotizador, ruta.

## 4. Contratos de API

Algunos endpoints.

## 5. Lógica y Edge Cases

Servicios de backend (Strapi)

(Además, servicios para cada Content Type restante: agencia, cotizador, pauta)

## 6. Seguridad

Auth.

## 7. Infraestructura

Docker.
`;
    const out = injectAsIsCodebaseEvidenceIntoMdd(mdd, ERP_SNIPPET + OOH_SNIPPET);
    assert.doesNotMatch(out, /PHP 8\.1 \+ Laravel/i);
    assert.doesNotMatch(out, /Vue 3 \+ Inertia/i);
    assert.doesNotMatch(out, /\| Backend ERP \| PHP/i);
    assert.match(out, /## 2\. Arquitectura[\s\S]*Strapi CMS/);
    assert.match(out, /## 2\. Arquitectura[\s\S]*React SPA/);
    assert.match(out, /### Diagrama de Componentes[\s\S]*flowchart TB/);
    assert.doesNotMatch(out, /Otras entidades significativas/i);
    assert.match(out, /## 3\. Modelo de Datos[\s\S]*\| pauta \|/);
    assert.match(out, /## 4\. Contratos de API[\s\S]*\| \/campanias \|/);
    assert.doesNotMatch(out, /\(Además,\s*servicios para cada Content Type restante/i);
    assert.match(out, /## 5\. Lógica[\s\S]*\| strapi:agencia \|/);
    assert.match(out, /## 5\. Lógica[\s\S]*\| strapi:cotizador \|/);
    assert.match(out, /## 6\. Seguridad/);
  });
});
