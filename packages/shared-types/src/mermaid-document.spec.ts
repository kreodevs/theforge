import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOrphanFlowchartLine,
  isOrphanSequenceDiagramLine,
  mergeSplitMermaidContinuationFences,
  normalizeMermaidInDocument,
  repairFragmentedSequenceMermaidInDocument,
  stripMarkdownLeakFromMermaidDiagramBody,
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
