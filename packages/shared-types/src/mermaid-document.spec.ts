import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ensureErDiagramHeader,
  isOrphanErDiagramLine,
  isOrphanFlowchartLine,
  isOrphanSequenceDiagramLine,
  mergeSplitMermaidContinuationFences,
  normalizeMermaidInDocument,
  normalizeMermaidDiagramBody,
  quoteFlowchartLabelsWithParens,
  repairErDiagramPkFkCommas,
  repairFragmentedSequenceMermaidInDocument,
  stripErDiagramSqlDefaultArtifacts,
  stripMarkdownLeakFromMermaidDiagramBody,
  validateMermaid,
} from "./mermaid.js";
import { formatDocumentMarkdown } from "./format-document-markdown.js";

describe("isOrphanSequenceDiagramLine", () => {
  it("detecta flechas con prefijo ### o viñeta", () => {
    assert.equal(isOrphanSequenceDiagramLine("### PrecioService->>CostoRepo: findActivo()"), true);
    assert.equal(isOrphanSequenceDiagramLine("- API-->>Consumidor: 200 OK"), true);
    assert.equal(isOrphanSequenceDiagramLine("### 1.2 Flujo de Cron"), false);
    assert.equal(isOrphanSequenceDiagramLine("| Paso | Acción |"), false);
  });
});

describe("repairFragmentedSequenceMermaidInDocument", () => {
  it("fusiona sequenceDiagram partido por cierre prematuro del fence", () => {
    const doc = `### 1.1 Flujo

\`\`\`mermaid
sequenceDiagram
    participant API
    participant Svc
    API->>Svc: calcular()
\`\`\`
### Svc->>Repo: findActivo()
    Repo-->>Svc: datos
    alt error
    Svc-->>API: 422
    end
- Svc-->>API: OK
- API-->>Cliente: 200

### 1.2 Siguiente sección`;
    const out = repairFragmentedSequenceMermaidInDocument(doc);
    assert.match(out, /calcular\(\)\n\s*Svc->>Repo: findActivo/);
    assert.match(out, /API-->>Cliente: 200\n\`\`\`/);
    assert.doesNotMatch(out, /```\n### Svc->>/);
    assert.match(out, /### 1\.2 Siguiente sección/);
  });
});

describe("isOrphanFlowchartLine", () => {
  it("detecta aristas flowchart con prefijo ### o viñeta", () => {
    assert.equal(isOrphanFlowchartLine("### ODOO[Odoo ERP] -->|Webhook| NEW"), true);
    assert.equal(isOrphanFlowchartLine("- FE -->|GET /site-costs| NEW"), true);
    assert.equal(isOrphanFlowchartLine("- BE --> NEW"), true);
    assert.equal(isOrphanFlowchartLine("subgraph LEGACY[OBP]"), true);
    assert.equal(isOrphanFlowchartLine("end"), true);
    assert.equal(isOrphanFlowchartLine("- Evento en sistema origen: texto largo"), false);
    assert.equal(isOrphanFlowchartLine("## Requerimientos técnicos por item"), false);
    assert.equal(isOrphanFlowchartLine('• OBP -->|"Sincronización de costos base"| CAT'), true);
    assert.equal(isOrphanFlowchartLine("1. ODOO -->|Costos reales| CAT"), true);
  });
});

describe("mergeSplitMermaidContinuationFences", () => {
  it("fusiona sequenceDiagram volcado en un 2.º fence ```dockerfile", () => {
    const doc = `## Flujo

\`\`\`mermaid
sequenceDiagram
    participant User as Ejecutivo
    participant FE as Frontend OBP
    participant API as Microservicio NEW
\`\`\`

\`\`\`dockerfile
User->>FE: Aplica descuento
- FE->>API: GET /precios/calcular
- API-->>FE: 403 (margen < minimo)
\`\`\`

### Siguiente`;
    const out = mergeSplitMermaidContinuationFences(doc);
    assert.doesNotMatch(out, /```dockerfile/);
    assert.match(out, /participant API as Microservicio NEW\n\s*User->>FE: Aplica descuento/);
    assert.match(out, /API-->>FE: 403[\s\S]*```/);
    // Un solo fence mermaid resultante.
    assert.equal((out.match(/```mermaid/g) ?? []).length, 1);
    assert.match(out, /### Siguiente/);
  });

  it("NO fusiona dos diagramas mermaid distintos (erDiagram + flowchart)", () => {
    const doc = `\`\`\`mermaid
erDiagram
  MEDIO {
    uuid id
  }
\`\`\`
\`\`\`mermaid
flowchart LR
  A --> B
\`\`\``;
    const out = mergeSplitMermaidContinuationFences(doc);
    assert.equal((out.match(/```mermaid/g) ?? []).length, 2);
    assert.match(out, /erDiagram/);
    assert.match(out, /flowchart LR/);
  });
});

describe("normalizeMermaidInDocument — flowchart leak + split fence", () => {
  it("re-absorbe aristas flowchart fugadas tras cierre prematuro del fence", () => {
    const doc = `## Diagrama de integración

\`\`\`mermaid
flowchart LR
    subgraph NEW["Microservicio Costos"]
        API[API REST]
    end
    subgraph LEGACY["OBP"]
        FE[Frontend OBP]
    end
\`\`\`
### ODOO[Odoo ERP] -->|Webhook| NEW
- FE -->|GET /site-costs| NEW
- BE --> NEW

## Requerimientos`;
    const out = normalizeMermaidInDocument(doc);
    assert.doesNotMatch(out, /```\n### ODOO/);
    assert.match(out, /ODOO\[Odoo ERP\] -->\|Webhook\| NEW/);
    assert.match(out, /FE -->\|GET \/site-costs\| NEW/);
    assert.match(out, /BE --> NEW/);
    assert.equal((out.match(/```mermaid/g) ?? []).length, 1);
    assert.match(out, /## Requerimientos/);
  });

  it("limpia \\n literal y entrecomilla llaves en etiquetas de arista", () => {
    const doc = `\`\`\`mermaid
flowchart LR
    BE[Backend OBP\\n(Node/Express)]
    FE -->|GET /listas-precios/{id}/limites| NEW
\`\`\``;
    const out = normalizeMermaidInDocument(doc);
    assert.doesNotMatch(out, /\\n/);
    assert.match(out, /\|"GET \/listas-precios\/\{id\}\/limites"\|/);
  });
});

describe("normalizeMermaidInDocument — split sequence into unclosed ```dockerfile (real handoff-spec)", () => {
  it("absorbe los mensajes del 2.º fence sin cerrar y no se traga la siguiente sección", () => {
    const doc = `### NEW-LEG-01 — Cotizador

- **Diagrama(s):** (sequence)

\`\`\`mermaid
sequenceDiagram
    participant User as Ejecutivo Ventas
    participant FE as Cotizador (RentaUrbano.tsx)
    participant BE as Microservicio Costos
\`\`\`

\`\`\`dockerfile
User->>FE: Selecciona medio
    FE->>BE: GET /api/v1/site-costs?ubicacion_ooh_id={id}
    BE-->>FE: [{nombre: "Instalación"}] o []
    alt tiene costos
    FE->>User: Tooltip con nombres
    else sin costos
    FE->>User: Tooltip "Sin costos"
    end

### NEW-LEG-02 — Alertamiento y bloqueo por margen mínimo
- **Propuesta (NEW):** texto de la siguiente sección.
- **Diagrama(s):** (flowchart) Proceso.

\`\`\`

\`\`\`mermaid
flowchart TD
    A[Inicio] --> B{Margen ok?}
    B -->|Sí| C[Continuar]
    B -->|No| D[Bloquear]
\`\`\``;
    const out = normalizeMermaidInDocument(doc);
    // No queda ningún fence dockerfile.
    assert.doesNotMatch(out, /```dockerfile/);
    // Los mensajes quedaron dentro del bloque del sequenceDiagram.
    assert.match(out, /participant BE as[\s\S]*User->>FE: Selecciona medio/);
    assert.match(out, /FE->>User: Tooltip "Sin costos"[\s\S]*?end[\s\S]*?```/);
    // La prosa de NEW-LEG-02 quedó FUERA del diagrama (como markdown, no como código).
    assert.match(out, /### NEW-LEG-02 — Alertamiento y bloqueo por margen mínimo/);
    assert.match(out, /- \*\*Propuesta \(NEW\):\*\* texto de la siguiente sección\./);
    // El flowchart de NEW-LEG-02 sigue siendo un bloque mermaid válido propio.
    assert.match(out, /```mermaid\nflowchart TD/);
    // Exactamente 2 bloques mermaid (sequence + flowchart), sin huérfanos.
    assert.equal((out.match(/```mermaid/g) ?? []).length, 2);
    // El ``` huérfano (cierre del dockerfile) fue eliminado: no hay un fence vacío suelto.
    assert.doesNotMatch(out, /\n```\n+```mermaid\nflowchart TD/);
  });
});

describe("normalizeMermaidInDocument — auto-repara subgraph_ID corrupto ya persistido", () => {
  it("restaura `subgraph_NEW[...]` → `subgraph NEW[...]` (documento viejo, sin re-sync)", () => {
    const doc = `## Diagrama de integración (Mermaid)

\`\`\`mermaid
flowchart LR
    subgraph_NEW["Microservicio Costos y Listas de Precios"]
        CC["GET /api/v1/catalogo-costos"]
        LP["GET /api/v1/listas-precios/{id}/limites"]
    end

    subgraph_LEGACY["OBP (Legacy)"]
        FE["Frontend Cotizador"]
        DE["OBP Data Editor"]
    end

    FE -->|"NEW-LEG-01: hover tooltip"| CC
    DE -->|"NEW-LEG-03: asignar costos"| LP
\`\`\``;
    const out = normalizeMermaidInDocument(doc);
    assert.doesNotMatch(out, /subgraph_NEW/);
    assert.doesNotMatch(out, /subgraph_LEGACY/);
    assert.match(out, /subgraph NEW\["Microservicio Costos y Listas de Precios"\]/);
    assert.match(out, /subgraph LEGACY\["OBP \(Legacy\)"\]/);
    // No re-corrompe ni rompe los nodos hijos ni las aristas.
    assert.match(out, /CC\["GET \/api\/v1\/catalogo-costos"\]/);
    assert.match(out, /FE -->\|"NEW-LEG-01: hover tooltip"\| CC/);
  });
});

describe("normalizeMermaidDiagramBody — no trunca etiquetas legítimas largas", () => {
  it("preserva subgraph y aristas con <br/> y rutas (no corta a 56 chars)", () => {
    const doc = `\`\`\`mermaid
flowchart LR
    subgraph Microservicio_NEW["Microservicio Costos y Listas de Precios<br/>(Node/Express)"]
        API["GET /api/v1/listas-precios"]
    end
    FE -->|"POST/GET/PUT/DELETE costos asociados<br/>(endpoint a crear)"| API
\`\`\``;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /\(Node\/Express\)"\]/);
    assert.doesNotMatch(out, /\(Node\/Expre"\]/);
    assert.match(out, /\(endpoint a crear\)"\|/);
  });
});

describe("stripMarkdownLeakFromMermaidDiagramBody", () => {
  it("trunca TechnicalMetadata filtrado en sequenceDiagram", () => {
    const body = `sequenceDiagram
  participant API
  participant DB
  API->>DB: SELECT
  DB-->>API: rows
**TechnicalMetadata**- \`cicd_pipeline\`: pipeline CI`;
    const out = stripMarkdownLeakFromMermaidDiagramBody(body);
    assert.match(out, /DB-->>API: rows/);
    assert.doesNotMatch(out, /TechnicalMetadata/);
    assert.doesNotMatch(out, /cicd_pipeline/);
  });
});

describe("normalizeMermaidInDocument", () => {
  it("saca viñetas SSO pegadas dentro del fence mermaid", () => {
    const doc = `#### Flujo de autenticación

\`\`\`mermaid
flowchart TD
  evt["Evento"]
  post["POST"]
  evt --> post
- Usuario → Frontend sin token
- Al cargar la app, verificar token
\`\`\`

#### Integración backend`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /evt --> post/);
    assert.doesNotMatch(out, /post\n- Usuario/);
    assert.match(out, /```\n\n- Usuario → Frontend/);
    assert.match(out, /#### Integración backend/);
  });

  it("no fusiona markdown tras el cierre del bloque mermaid", () => {
    const doc = `### Flujo de sincronización

\`\`\`mermaid
flowchart TD
  s0("Paso uno")
  s0 --> s1
  s1("Paso dos")
\`\`\`

- Evento en sistema origen: texto largo
- Endpoint receptor: POST webhooks
`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /```\n\n- Evento en sistema/);
    assert.doesNotMatch(out, /s1\("Paso dos"\)\n- Evento/);
    assert.doesNotMatch(out, /--> s1- Evento/);
  });

  it("saca viñetas numeradas del fence de sincronización webhook", () => {
    const doc = `### Flujo de sincronización vía webhooks

\`\`\`mermaid
flowchart TD
  s0 --> s1
  s1 --> s2
- 1. **Evento en sistema origen:** texto
- 2. **Endpoint receptor:** POST
\`\`\`

### Endpoint receptor`;
    const out = normalizeMermaidInDocument(doc);
    assert.doesNotMatch(out, /s1 --> s2\n- 1\./);
    assert.match(out, /```\n\n- 1\. \*\*Evento/);
  });

  it("no rompe `subgraph ID[Título con espacios]` (no lo pega como subgraph_ID)", () => {
    const doc = `## Diagrama

\`\`\`mermaid
flowchart LR
    subgraph NEW[Microservicio Costos y Listas de Precios]
        MC1[(DB costos)]
        API_CostTypes[GET /api/v1/cost-types]
    end
    subgraph LEGACY[OBP]
        FE[Frontend oohbp2]
    end
    API_CostTypes --> FE
\`\`\`
`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /subgraph NEW\[Microservicio Costos y Listas de Precios\]/);
    assert.match(out, /subgraph LEGACY\[OBP\]/);
    assert.doesNotMatch(out, /subgraph_NEW/);
    assert.doesNotMatch(out, /subgraph_LEGACY/);
  });

  it("entrecomilla etiquetas con llaves (paths /{id}) que rompen el parser", () => {
    const doc = `## Diagrama

\`\`\`mermaid
flowchart LR
    API_ListasPrecios[GET /api/v1/listas-precios/{id}/limites]
    MC1[(DB costos)]
\`\`\`
`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /API_ListasPrecios\["GET \/api\/v1\/listas-precios\/\{id\}\/limites"\]/);
    // El nodo cilindro sin llaves no se entrecomilla.
    assert.match(out, /MC1\[\(DB costos\)\]/);
  });

  it("repara sequenceDiagram con ### y viñetas fuera del fence", () => {
    const doc = `### 1.1 Cálculo

\`\`\`mermaid
sequenceDiagram
    participant C as Consumidor
    participant API
    C->>API: POST /precio/calcular
    API->>Auth: Validar JWT
    Auth-->>API: OK
\`\`\`
### API->>Svc: calcularPrecio(dto)
    Svc-->>API: resultado
- API-->>C: 200 OK

### 1.2 Cron`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /Auth-->>API: OK[\s\S]*API->>Svc: calcularPrecio/);
    assert.match(out, /API-->>C: 200 OK[\s\S]*```/);
    assert.doesNotMatch(out, /```\n### API->>/);
  });
});

describe("formatDocumentMarkdown + mermaid", () => {
  it("preserva bullets fuera del fence", () => {
    const doc = `## Doc

\`\`\`mermaid
flowchart TD
  a("A") --> b("B")
\`\`\`

## Siguiente`;
    const out = formatDocumentMarkdown(doc);
    assert.match(out, /```mermaid[\s\S]*?```[\s\S]*## Siguiente/);
  });
});

describe("validateMermaid flowchart subgraph", () => {
  it("no marca subgraph ID[label] como node ID con espacios", () => {
    const body = `flowchart TD
  subgraph fe_React["Frontend React"]
    A --> B
  end`;
    assert.deepEqual(validateMermaid(body), []);
  });

  it("sí detecta node ID real con espacio antes de [", () => {
    const body = `flowchart TD
  My Node[Etiqueta]`;
    const errors = validateMermaid(body);
    assert.ok(errors.some((e) => /contains spaces/i.test(e)));
  });
});

describe("normalizeMermaidDiagramBody erDiagram PK/FK", () => {
  it("repara diagrama auth con id PK FK persistido", () => {
    const raw = `erDiagram
  tenants {
    uuid id PK
    string name
  }
  users {
    uuid id PK FK
    uuid tenant_id FK
    string email
  }
  sessions {
    uuid id PK FK
    uuid user_id FK
    datetime expires_at
  }`;
    const out = normalizeMermaidDiagramBody(raw);
    assert.doesNotMatch(out, /\bPK\s+FK\b/i);
    assert.match(out, /uuid id PK/);
  });
});

describe("repairErDiagramPkFkCommas", () => {
  it("colapsa PK, FK y PK FK a un solo marcador PK", () => {
    assert.equal(repairErDiagramPkFkCommas("uuid tenant_id PK, FK"), "uuid tenant_id PK");
    assert.equal(repairErDiagramPkFkCommas("uuid id PK FK"), "uuid id PK");
    assert.equal(repairErDiagramPkFkCommas("uuid id FK PK"), "uuid id PK");
  });

  it("ensureErDiagramHeader antepone erDiagram si falta", () => {
    const out = ensureErDiagramHeader("users {\n  uuid id PK\n}");
    assert.match(out, /^erDiagram/);
  });
});

describe("stripErDiagramSqlDefaultArtifacts", () => {
  it("elimina columnas ficticias uuid default del LLM", () => {
    const raw = `erDiagram
  superadmins {
    uuid id PK
    uuid default
    string email
  }
  tenant_users {
    uuid id PK
    uuid default FK
    uuid tenant_id FK
  }`;
    const out = stripErDiagramSqlDefaultArtifacts(raw);
    assert.doesNotMatch(out, /uuid default/i);
    assert.match(out, /uuid id PK/);
    assert.match(out, /string email/);
  });
});

describe("isOrphanErDiagramLine", () => {
  it("detecta relaciones erDiagram con viñeta fuera del fence", () => {
    assert.equal(
      isOrphanErDiagramLine('• COSTO_BASE }o--o{ FORMATO_MEDIO : "asignado opcionalmente"'),
      true,
    );
    assert.equal(isOrphanErDiagramLine("FORMATO_MEDIO }|--|| TIPO_MEDIO : pertenece a"), true);
    assert.equal(isOrphanErDiagramLine("## 5. Alcance"), false);
  });
});

describe("repairFragmentedSequenceMermaidInDocument BRD-style", () => {
  it("repara flowchart §4.1 con aristas en viñetas fuera del fence", () => {
    const doc = `### 4.1 Arquitectura de integración

\`\`\`mermaid
flowchart LR
  subgraph ORIGEN["Sistemas Origen"]
    OBP["One Business Platform (OBP)"]
    ODOO["ERP Odoo"]
  end
  subgraph MC["Sistema de Márgenes y Costos"]
    CAT["Catálogo de costos"]
  end
\`\`\`
• OBP -->|"Sincronización de costos base"| CAT
• ODOO -->|"Costos reales de órdenes de compra"| CAT

### 4.2 Diagrama entidad-relación`;
    const out = repairFragmentedSequenceMermaidInDocument(doc);
    assert.match(out, /OBP -->|"Sincronización de costos base"| CAT[\s\S]*ODOO -->|"Costos reales/);
    assert.doesNotMatch(out, /• OBP/);
    assert.match(out, /```mermaid[\s\S]*ODOO -->[\s\S]*```/);
  });

  it("repara erDiagram §4.2 con relaciones en viñetas fuera del fence", () => {
    const doc = `### 4.2 Diagrama entidad-relación

\`\`\`mermaid
erDiagram
  COSTO_BASE {
    string tipo
    decimal monto
  }
  FORMATO_MEDIO {
    string nombre
  }
\`\`\`
• COSTO_BASE }o--o{ FORMATO_MEDIO : "asignado opcionalmente"
• FORMATO_MEDIO }|--|| TIPO_MEDIO : "pertenece a"

## 5. Alcance`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /COSTO_BASE \}o--o\{ FORMATO_MEDIO/);
    assert.match(out, /FORMATO_MEDIO \}\|--\|\| TIPO_MEDIO/);
    assert.doesNotMatch(out, /```\n[\s\S]*```\n• COSTO_BASE/);
  });

  it("normaliza viñetas dentro del fence flowchart", () => {
    const body = `flowchart LR
  A["Origen"]
• A -->|"sync"| B["Destino"]`;
    const out = normalizeMermaidDiagramBody(body);
    assert.match(out, /A -->|"sync"| B/);
    assert.doesNotMatch(out, /^• /m);
  });
});

describe("quoteFlowchartLabelsWithParens", () => {
  it("entrecomilla nodos con paréntesis sin romper cilindros [(\"…\")]", () => {
    const raw = `flowchart TB
  API[NestJS API (Contenedor)]
  DB[("PostgreSQL · 29 tablas")]`;
    const out = quoteFlowchartLabelsWithParens(raw);
    assert.match(out, /API\["NestJS API \(Contenedor\)"\]/);
    assert.match(out, /DB\[\("PostgreSQL · 29 tablas"\)\]/);
    assert.doesNotMatch(out, /DB\["\("PostgreSQL/);
  });

  it("normalizeMermaidDiagramBody preserva diagrama de componentes propuesto", () => {
    const raw = `flowchart TB
  subgraph be_NestJS["NestJS · Servidor"]
    BE_SQL[("PostgreSQL · 29 tablas")]
    BE_GRAPH[("FalkorDB")]
  end
  BE_DOMAIN --> BE_SQL
_Propuesta derivada de §2–§4: nota markdown.`;
    const out = normalizeMermaidDiagramBody(raw);
    assert.match(out, /BE_SQL\[\("PostgreSQL · 29 tablas"\)\]/);
    assert.doesNotMatch(out, /Propuesta derivada/);
  });
});
