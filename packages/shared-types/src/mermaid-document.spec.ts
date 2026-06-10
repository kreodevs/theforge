import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOrphanGraphEdgeLine,
  isOrphanSequenceDiagramLine,
  normalizeMermaidInDocument,
  repairFragmentedGraphMermaidInDocument,
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

describe("repairFragmentedGraphMermaidInDocument", () => {
  it("fusiona aristas graph partidas por cierre prematuro del fence (KMS §1)", () => {
    const doc = readFixture("kms-isd-graph-edges-outside.fixture.txt");
    const out = repairFragmentedGraphMermaidInDocument(doc);
    assert.match(out, /KMS_CLI -->|llamadas API REST| KMS_GW\n```\n\n### Inventario/);
    assert.match(out, /KMS_GW -->|autenticación LDAP| AD[\s\S]*KMS_CLI -->|llamadas API REST| KMS_GW/);
    assert.doesNotMatch(out, /```\n### KMS_GW -->/);
    assert.doesNotMatch(out, /### KMS_GW -->/);
  });

  it("no absorbe tabla markdown tras el grafo", () => {
    const doc = readFixture("kms-isd-graph-edges-outside.fixture.txt");
    const out = repairFragmentedGraphMermaidInDocument(doc);
    assert.match(out, /\| Sistema\s+\| Dirección/);
    assert.match(out, /### Inventario de sistemas colindantes/);
  });

  it("es idempotente en documento ya reparado", () => {
    const doc = readFixture("kms-isd-graph-edges-outside.fixture.txt");
    const once = repairFragmentedGraphMermaidInDocument(doc);
    const twice = repairFragmentedGraphMermaidInDocument(once);
    assert.equal(twice, once);
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
