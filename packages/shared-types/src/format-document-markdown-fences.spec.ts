import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatDocumentMarkdown } from "./format-document-markdown.js";
import { retagMislabeledMermaidFences } from "./mermaid.js";

const dir = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) => readFileSync(join(dir, name), "utf8");

describe("formatDocumentMarkdown — fences KMS ISD (3ª corrida)", () => {
  it("libera ### 4.2 tragado dentro de fence dockerfile/sequence", () => {
    const raw = readFixture("kms-isd-heading-in-fence.fixture.txt");
    const out = formatDocumentMarkdown(raw);
    assert.match(out, /Note over Auth:[^\n]*\n\n```\n### 4\.2 Envío de auditoría a SIEM/);
    assert.match(out, /```mermaid[\s\S]*sequenceDiagram[\s\S]*SIEM Corporativo/);
    assert.doesNotMatch(out, /```dockerfile/);
  });

  it("retag dockerfile con sequenceDiagram → mermaid", () => {
    const raw = readFixture("kms-isd-dockerfile-sequence.fixture.txt");
    const out = retagMislabeledMermaidFences(raw);
    assert.match(out, /^```mermaid\nsequenceDiagram/m);
    assert.doesNotMatch(out, /```dockerfile/);
    assert.match(out, /User->>GW: POST \/api\/v1\/auth\/login/);
  });

  it("regresión: extracto sano del ISD KMS (§0 Metadata) pasa el pipeline sin cambios", () => {
    const raw = readFixture("kms-isd-healthy-metadata.fixture.txt");
    const out = formatDocumentMarkdown(raw);
    assert.equal(out, raw.trim());
  });

  it("4ª corrida KMS §1: aristas del grafo dentro del bloque mermaid", () => {
    const raw = readFixture("kms-isd-graph-edges-outside.fixture.txt");
    const out = formatDocumentMarkdown(raw);
    assert.match(out, /KMS_CLI -->|llamadas API REST| KMS_GW\n```/);
    assert.doesNotMatch(out, /```\n### KMS_GW -->/);
    assert.match(out, /\| Sistema\s+\| Dirección/);
  });
});
