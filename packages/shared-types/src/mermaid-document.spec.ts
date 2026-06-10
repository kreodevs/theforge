import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOrphanGraphEdgeLine,
  isOrphanGraphStyleLine,
  isOrphanSequenceDiagramLine,
  normalizeMermaidInDocument,
  repairFragmentedGraphMermaidInDocument,
  repairFragmentedMermaidInDocument,
  repairFragmentedSequenceMermaidInDocument,
  stripMarkdownLeakFromMermaidDiagramBody,
} from "./mermaid.js";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => readFileSync(join(dir, name), "utf8");

describe("isOrphanSequenceDiagramLine", () => {
  it("detecta flechas con prefijo ### o viñeta", () => {
    assert.equal(isOrphanSequenceDiagramLine("### PrecioService->>CostoRepo: findActivo()"), true);
    assert.equal(isOrphanSequenceDiagramLine("- API-->>Consumidor: 200 OK"), true);
    assert.equal(isOrphanSequenceDiagramLine("### 1.2 Flujo de Cron"), false);
    assert.equal(isOrphanSequenceDiagramLine("| Paso | Acción |"), false);
  });
});

describe("isOrphanGraphEdgeLine", () => {
  it("detecta aristas con prefijo ### o viñeta", () => {
    assert.equal(isOrphanGraphEdgeLine("### KMS_GW -->|autenticación LDAP| AD"), true);
    assert.equal(isOrphanGraphEdgeLine("- KMS_BACKEND -->|exportación NDJSON| SIEM"), true);
    assert.equal(isOrphanGraphEdgeLine("### Inventario de sistemas colindantes"), false);
    assert.equal(isOrphanGraphEdgeLine("| Sistema | Dirección |"), false);
  });
});

describe("isOrphanGraphStyleLine", () => {
  it("detecta style/classDef fuera del fence con prefijo ### o viñeta", () => {
    assert.equal(isOrphanGraphStyleLine("    style KMS fill:#e0f7fa,stroke:#00796b"), true);
    assert.equal(isOrphanGraphStyleLine("### style AD fill:#ffe0b2"), true);
    assert.equal(isOrphanGraphStyleLine("### Inventario de sistemas colindantes"), false);
    assert.equal(isOrphanGraphStyleLine("AD --> KMS"), false);
  });
});

describe("repairFragmentedGraphMermaidInDocument", () => {
  it("T1: fusiona aristas y style graph partidos (golden KMS §1 5/5)", () => {
    const doc = readFixture("kms-isd-graph-styles-outside.fixture.txt");
    const expected = readFixture("kms-isd-graph-styles-outside.expected.txt");
    const out = repairFragmentedGraphMermaidInDocument(doc);
    assert.equal(out, expected);
  });

  it("T2: absorbe aristas pero no inventario/tabla tras el grafo", () => {
    const doc = readFixture("kms-isd-graph-edges-outside.fixture.txt");
    const out = repairFragmentedGraphMermaidInDocument(doc);
    assert.match(out, /KMS_CLI -->|llamadas API REST| KMS_GW\n```\n\n### Inventario/);
    assert.match(out, /KMS_GW -->|autenticación LDAP| AD[\s\S]*KMS_CLI -->|llamadas API REST| KMS_GW/);
    assert.doesNotMatch(out, /```\n### KMS_GW -->/);
    assert.doesNotMatch(out, /### KMS_GW -->/);
    assert.match(out, /\| Sistema\s+\| Dirección/);
    assert.match(out, /### Inventario de sistemas colindantes/);
  });

  it("T2b: grafo cerrado solo con nodos + inventario → diff vacío", () => {
    const doc = readFixture("kms-isd-graph-nodes-only.fixture.txt");
    const out = repairFragmentedGraphMermaidInDocument(doc);
    assert.equal(out, doc);
  });

  it("T3: es idempotente en documento ya reparado (T1)", () => {
    const doc = readFixture("kms-isd-graph-styles-outside.fixture.txt");
    const once = repairFragmentedGraphMermaidInDocument(doc);
    const twice = repairFragmentedGraphMermaidInDocument(once);
    assert.equal(twice, once);
  });

  it("T4: no modifica sequenceDiagram fragmentado", () => {
    const doc = `### 1.1 Flujo

\`\`\`mermaid
sequenceDiagram
    participant API
    participant Svc
    API->>Svc: calcular()
\`\`\`
### Svc->>Repo: findActivo()
    Repo-->>Svc: datos

### 1.2 Siguiente sección`;
    const out = repairFragmentedGraphMermaidInDocument(doc);
    assert.equal(out, doc);
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
    const out = normalizeMermaidInDocument(repairFragmentedMermaidInDocument(doc));
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

  it("T5: §1 literal 5ª corrida KMS — grafo completo y fences balanceados", () => {
    const raw = readFixture("kms-isd-graph-styles-outside.fixture.txt");
    const out = formatDocumentMarkdown(raw);
    assert.match(out, /^```mermaid\ngraph LR[\s\S]*```\s*$/m);
    assert.doesNotMatch(out, /### AD\[/);
    assert.match(out, /AD\[Active Directory\] -- LDAPS --> KMS/);
    assert.match(out, /style KMS fill:#e0f7fa,stroke:#00796b/);
    assert.match(out, /style AD fill:#ffe0b2,stroke:#e65100/);
    const opens = (out.match(/```mermaid/gi) ?? []).length;
    const closes = (out.match(/^```\s*$/gm) ?? []).length;
    assert.equal(opens, closes, "fences balanceados");
    assert.equal(opens, 1);
  });
});
