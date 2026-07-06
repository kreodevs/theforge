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
  repairErDiagramBrdMarkdownLeaks,
  repairFragmentedSequenceMermaidInDocument,
  repairMermaidFenceClosedWithMermaidTag,
  repairUnfencedMermaidInDocument,
  stripErDiagramSqlDefaultArtifacts,
  stripMarkdownLeakFromMermaidDiagramBody,
  stripMermaidFenceWrappers,
  dedupeMermaidDiagramHeader,
  decodeMermaidHtmlEntities,
  prepareMermaidDiagramForRender,
  quoteFlowchartEdgeLabels,
  repairFlowchartMissingTargetNodeIds,
  splitFlowchartMultiEdgeLines,
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
    assert.match(out, /FE -->\|"GET \/site-costs"\| NEW/);
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

describe("repairUnfencedMermaidInDocument — BRD sin fences", () => {
  const unfencedBrdSection4 = `## 4. Diagramas de referencia (Mermaid)

### 4.1 Arquitectura de integración (el ecosistema)

flowchart LR
    subgraph ORIGEN["Sistemas Origen"]
    OBP["One Business Platform (OBP)"]
    ODOO["ERP Odoo (Costos reales)"]
    end
    subgraph MC["Sistema de Márgenes y Costos"]
    CAT["Catálogo de costos base"]
    end
- OBP -->|"Sincronización de costos base"| CAT
- ODOO -->|"Costos reales de órdenes de compra"| CAT

### 4.2 Diagrama entidad-relación (estructura de datos de negocio)

erDiagram
    COSTO_BASE {
    string nombre
    decimal valor_base
    }
    FORMATO_MEDIO {
    string nombre
    }
- COSTO_BASE }o--o{ FORMATO_MEDIO : "asignado opcionalmente"
- FORMATO_MEDIO }|--|| TIPO_MEDIO : "pertenece a"

### 4.3 Flujos críticos

#### Flujo 1: Actualización automática

stateDiagram-v2
- [*] --> Idle: Inicio del día
- Idle --> CalculandoPromedio: Cron diario ejecutado
- CalculandoPromedio --> Idle: Sin cambios

#### Flujo 2: Creación de lista de precios

flowchart TD
- A["Admin Trade inicia sesión"] --> B["Crea catálogo de niveles"]
- B --> C["Selecciona crear lista"]

#### Flujo 3: Cálculo de precio

sequenceDiagram
- participant Comercial as Comercial (OBP)
- participant OBP as Sistema Consumidor (OBP)
- participant SMC as Sistema Márgenes y Costos

### Comercial->>OBP: Selecciona formato y nivel
    OBP->>SMC: Solicita precio de venta
    SMC-->>OBP: Devuelve precio calculado
    OBP-->>Comercial: Muestra precio en cotización

---

## 5. Límites del Alcance`;

  it("envuelve flowchart/erDiagram/state/sequence sin fence y quita viñetas", () => {
    const out = normalizeMermaidInDocument(unfencedBrdSection4);
    const blocks = out.match(/```mermaid[\s\S]*?```/g) ?? [];
    assert.ok(blocks.length >= 5, `expected >=5 mermaid blocks, got ${blocks.length}`);
    assert.match(out, /```mermaid\nflowchart LR[\s\S]*OBP -->|"Sincronización de costos base"| CAT/);
    assert.match(out, /```mermaid\nerDiagram[\s\S]*COSTO_BASE \}o--o\{ FORMATO_MEDIO/);
    assert.match(out, /```mermaid\nstateDiagram-v2[\s\S]*\[\*\] --> Idle/);
    assert.match(out, /Comercial->>OBP: Selecciona formato/);
    assert.doesNotMatch(out, /^- OBP -->/m);
    for (const block of blocks) {
      assert.doesNotMatch(block, /Flujo 2: Creación/);
      assert.doesNotMatch(block, /Flujo 3: Cálculo/);
    }
  });

  it("formatDocumentMarkdown repara sección §4 BRD pegada sin fences", () => {
    const out = formatDocumentMarkdown(unfencedBrdSection4);
    assert.notEqual(out, unfencedBrdSection4);
    assert.match(out, /```mermaid[\s\S]*```/);
    assert.doesNotMatch(out, /^- COSTO_BASE \}o--o\{/m);
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

describe("stripMermaidFenceWrappers + dedupeMermaidDiagramHeader", () => {
  it("quita ```mermaid anidado del cuerpo antes de render", () => {
    const nested = `\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Active
\`\`\``;
    const out = normalizeMermaidDiagramBody(nested);
    assert.match(out, /^stateDiagram-v2/);
    assert.doesNotMatch(out, /```/);
    assert.match(out, /Idle --> Active/);
  });

  it("repara erDiagramerDiagram pegado", () => {
    const broken = "erDiagramerDiagram\n  USER {\n    uuid id PK\n  }";
    const out = normalizeMermaidDiagramBody(broken);
    assert.match(out, /^erDiagram\n/);
    assert.doesNotMatch(out, /erDiagramerDiagram/);
  });

  it("elimina cabecera erDiagram duplicada en líneas consecutivas", () => {
    const broken = "erDiagram\nerDiagram\n  ORDER {\n    uuid id PK\n  }";
    const out = dedupeMermaidDiagramHeader(broken);
    assert.equal(out.split("\n").filter((l) => /^erDiagram\b/i.test(l.trim())).length, 1);
  });

  it("normalizeMermaidInDocument fusiona erDiagram partidos con cierre ```mermaid", () => {
    const doc = `\`\`\`mermaid
erDiagram
  USER {
    uuid id PK
  }
\`\`\`mermaid
erDiagram
  ORDER {
    uuid id PK
  }
  USER ||--o{ ORDER : places
\`\`\``;
    const out = normalizeMermaidInDocument(doc);
    assert.equal((out.match(/```mermaid/gi) ?? []).length, 1);
    assert.match(out, /USER \|\|--o\{ ORDER/);
    assert.doesNotMatch(out, /erDiagramerDiagram/);
  });
});

describe("repairMermaidFenceClosedWithMermaidTag", () => {
  const ssoFlow = `### Flujo de Autenticación SSO (Frontend — JWT)

\`\`\`mermaid
sequenceDiagram
    participant Usuario
    participant Frontend
    participant SSO
    participant BackendChat
Usuario->>Frontend: Accede a la app
    Frontend->>SSO: Redirect a /auth/sso?applicationId=...
    SSO-->>BackendChat: Validación exitosa
    BackendChat-->>Frontend: Respuesta
\`\`\`mermaid
sequenceDiagram
    participant BackendChat
    participant SSO
    participant MCP
    BackendChat->>SSO: GET /auth/validate
    SSO-->>BackendChat: { valid: true, user: {...} }
    BackendChat-->>Usuario: Respuesta
\`\`\``;

  it("fusiona dos sequenceDiagram cerrados erróneamente con ```mermaid", () => {
    const out = normalizeMermaidInDocument(ssoFlow);
    assert.equal((out.match(/```mermaid/gi) ?? []).length, 1);
    assert.doesNotMatch(out, /```mermaid[\s\S]*```mermaid/);
    assert.match(out, /BackendChat-->>Usuario/);
    assert.match(out, /"\{ valid: true/);
    assert.doesNotMatch(out, /\nsequenceDiagram\n[\s\S]*```\nsequenceDiagram/m);
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

describe("splitFlowchartMultiEdgeLines + repairFlowchartMissingTargetNodeIds", () => {
  it("parte aristas concatenadas en una línea y repara cilindro sin id de nodo", () => {
    const raw = `flowchart TD
  G3 --> H3    G4 -->[(PostgreSQL 16)]`;
    const out = normalizeMermaidDiagramBody(raw);
    assert.match(out, /G3 --> H3\n\s*G4 --> PostgreSQL_16\[\(PostgreSQL 16\)\]/);
    assert.doesNotMatch(out, /G3 --> H3\s+G4/);
  });

  it("prepareMermaidDiagramForRender aplica split y repair en bloque fenced", () => {
    const fenced = `\`\`\`mermaid
flowchart TD
  G3 --> H3    G4 -->[(PostgreSQL 16)]
\`\`\``;
    const out = prepareMermaidDiagramForRender(fenced);
    assert.match(out, /G4 --> PostgreSQL_16\[\(PostgreSQL 16\)\]/);
    assert.doesNotMatch(out, /G3 --> H3\s+G4/);
  });

  it("splitFlowchartMultiEdgeLines conserva una sola arista intacta", () => {
    const raw = `flowchart LR
  A --> B`;
    const out = splitFlowchartMultiEdgeLines(raw);
    assert.equal(out, raw);
  });
});

const USER_SUBGRAPH_FLOWCHART = `flowchart LR
  subgraph ACTORES["Actores de Negocio"]
    USER["Usuario Autorizado"]
    ADMIN["Superadmin/Administrador"]
  end
  
  subgraph CANALES["Canales de Comunicación"]
    WAS["WhatsApp Business"]
    CHAT["Chat Interno"]
  end
  
  subgraph SISTEMAS["Sistemas Externos"]
    BITRIX["Bitrix24 MCP"]
  end
  
  subgraph INFRAESTRUCTURA["Infraestructura Corporativa"]
    SSO["SSO Corporativo"]
    LLM["Servicio LLM (OpenRouter/TokenLab)"]
    DB["Base de Datos Persistente"]
  end
USER -->|Comunica vía| WAS
  USER -->|Comunica vía| CHAT
  WAS -->|Autenticación y envío| COPILOTO["Copiloto IA Centralizado"]
  CHAT -->|API REST| COPILOTO
  COPILOTO <-->|Descubrimiento y ejecución| BITRIX
  COPILOTO <-->|Validación de credenciales| SSO
  COPILOTO <-->|Procesamiento de lenguaje| LLM
  COPILOTO <-->|Persistencia de datos| DB
  ADMIN -->|Monitorea y configura| COPILOTO`;

describe("subgraph flowchart — BRD ecosystem diagram", () => {
  it("prepareMermaidDiagramForRender keeps subgraph headers and strips fences", () => {
    const fenced = "```mermaid\n" + USER_SUBGRAPH_FLOWCHART + "\n```";
    const out = prepareMermaidDiagramForRender(fenced);
    assert.doesNotMatch(out, /```/);
    assert.doesNotMatch(out, /subgraph_/);
    assert.match(out, /subgraph ACTORES\["Actores de Negocio"\]/);
    assert.deepEqual(validateMermaid(out), []);
  });

  it("quoteFlowchartEdgeLabels wraps accent/spaced edge labels", () => {
    const out = quoteFlowchartEdgeLabels("flowchart LR\nUSER -->|Comunica vía| WAS");
    assert.match(out, /USER -->\|"Comunica vía"\| WAS/);
  });

  it("decodeMermaidHtmlEntities restores quoted subgraph titles", () => {
    const raw = `flowchart LR
  subgraph ACTORES[&quot;Actores&quot;]
    USER[&quot;U&quot;]
  end`;
    const out = normalizeMermaidDiagramBody(decodeMermaidHtmlEntities(raw));
    assert.match(out, /subgraph ACTORES\["Actores"\]/);
    assert.match(out, /USER\["U"\]/);
  });

  it("does not mangle parenthetical labels inside quoted node text", () => {
    const out = normalizeMermaidDiagramBody(USER_SUBGRAPH_FLOWCHART);
    assert.match(out, /LLM\["Servicio LLM \(OpenRouter\/TokenLab\)"\]/);
  });
});

/** erDiagram §4.2 tal como lo emite el LLM en BRD Copiloto (viñetas + ###). */
const BRD_COPILOTO_ER_DIAGRAM = `erDiagram
  TENANT {
    string nombre_organizacion
    datetime fecha_creacion
    string estado
  }
    USUARIO_AUTORIZADO {
- string nombre_completo
- string whatsapp
- string email
- string nivel_higiene
- datetime fecha_registro
- datetime ultimo_acceso

  }

### CANAL {
- enum tipo
- datetime fecha_creacion
- string estado

  }

### CONVERSACION {
- datetime fecha_inicio
- datetime fecha_ultima_actividad
- string estado

  }

### MENSAJE {
- text contenido
- enum rol
- datetime fecha_creacion

  }

### MEMORIA_PERSISTENTE {
- json historial_conversaciones
- json contexto_semantico
- json preferencias_usuario

  }

### WASDEVICE {
- string numero_telefono
- string estado_dispositivo

  }

### MCPPLUGIN {
- string nombre_sistema
- string url_servidor

  }

### MCPTOOL {
- string nombre_herramienta
- string tipo_permiso
- string descripcion

  }

### BITACORA {
- datetime fecha_intento
- enum tipo_fallo
- text mensaje_error

  }

### TENANT ||--o{ USUARIO_AUTORIZADO : "posee"
  TENANT ||--o{ CANAL : "posee"
  USUARIO_AUTORIZADO ||--o{ CANAL : "inicia"
  CANAL ||--o{ CONVERSACION : "contiene"
  CANAL ||--o{ MENSAJE : "almacena"
  USUARIO_AUTORIZADO ||--o{ MEMORIA_PERSISTENTE : "tiene"
  TENANT ||--o{ WASDEVICE : "posee"
  TENANT ||--o{ MCPPLUGIN : "posee"
  MCPPLUGIN ||--o{ MCPTOOL : "expone"
  TENANT ||--o{ BITACORA : "genera"`;

describe("erDiagram BRD Copiloto — viñetas y ### dentro del fence", () => {
  it("repairErDiagramBrdMarkdownLeaks quita viñetas y encabezados markdown", () => {
    const out = repairErDiagramBrdMarkdownLeaks(BRD_COPILOTO_ER_DIAGRAM);
    assert.doesNotMatch(out, /^-\s+string/m);
    assert.doesNotMatch(out, /^###\s+/m);
    assert.match(out, /USUARIO_AUTORIZADO \{\s*\n\s+string nombre_completo/);
    assert.match(out, /TENANT \|\|--o\{ USUARIO_AUTORIZADO/);
  });

  it("stripMarkdownLeakFromMermaidDiagramBody no trunca erDiagram BRD-style", () => {
    const out = stripMarkdownLeakFromMermaidDiagramBody(BRD_COPILOTO_ER_DIAGRAM);
    assert.ok(out.length > 500, `expected full diagram, got ${out.length} chars`);
    assert.match(out, /BITACORA/);
    assert.match(out, /TENANT \|\|--o\{ BITACORA/);
  });

  it("normalizeMermaidDiagramBody produce erDiagram completo y renderizable", () => {
    const out = normalizeMermaidDiagramBody(BRD_COPILOTO_ER_DIAGRAM);
    assert.ok(out.length > 500);
    assert.doesNotMatch(out, /^-\s+/m);
    assert.doesNotMatch(out, /^###\s+/m);
    assert.match(out, /MCPTOOL \{\s*\n\s+string nombre_herramienta/);
    assert.deepEqual(validateMermaid(out), []);
  });

  it("normalizeMermaidInDocument repara erDiagram en documento BRD §4.2", () => {
    const doc = `### 4.2 Diagrama entidad-relación

\`\`\`mermaid
${BRD_COPILOTO_ER_DIAGRAM}
\`\`\`

## 5. Alcance`;
    const out = normalizeMermaidInDocument(doc);
    assert.match(out, /```mermaid[\s\S]*TENANT \|\|--o\{ BITACORA[\s\S]*```/);
    assert.doesNotMatch(out, /^-\s+string/m);
  });

  it("prepareMermaidDiagramForRender no trunca erDiagram Copiloto", () => {
    const fenced = "```mermaid\n" + BRD_COPILOTO_ER_DIAGRAM + "\n```";
    const out = prepareMermaidDiagramForRender(fenced);
    assert.ok(out.length > 500);
    assert.match(out, /^erDiagram/);
    assert.match(out, /MCPPLUGIN \|\|--o\{ MCPTOOL/);
  });
});
