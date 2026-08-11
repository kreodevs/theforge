/**
 * Tests for deterministic §3 inventory composition.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDomainInventory } from "./domain-inventory.util.js";
import { extractPaso0DecisionCatalog } from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  composeDomainTableStubsSql,
  mergeDbgaCoreGapsIntoMdd,
  mergeDomainTablesIntoMdd,
  missingDomainEntities,
} from "./compose-section3-from-inventory.util.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const step0Path = join(repoRoot, "STEP_0-review.md");
const paso0Catalog = extractPaso0DecisionCatalog(readFileSync(step0Path, "utf8"));

const BRD = `
## 3. Capacidades
### 3.1 Gestión de conversaciones WhatsApp
Cuerpo con mensajes, canales y tenants.
### 3.2 Plugins MCP Bitrix
Integración mcp y tools.
### 3.3 Bitácora de fallos
Registro de peticiones no cumplidas.
`;

describe("compose-section3-from-inventory", () => {
  it("no inyecta tablas plataforma desde inventario en dominio KMS", () => {
    const brd = `
## 3. Capacidades
### 3.1 Gestión de claves
Rotación de claves y secretos. Sin chat ni MCP.
`;
    const inv = buildDomainInventory({ brdMarkdown: brd });
    const mdd = `# MDD
## 1. Contexto
KMS interno. Sin chat ni MCP.
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE keys (id UUID PRIMARY KEY);
\`\`\`
`;
    const missing = missingDomainEntities(inv, mdd);
    assert.ok(!missing.includes("channels"));
    assert.ok(!missing.includes("llm_configs"));
    assert.ok(!missing.includes("mcp_plugins"));
    assert.ok(!missing.includes("requests"));
    const { injected } = mergeDomainTablesIntoMdd(mdd, inv);
    assert.ok(!injected.includes("channels"));
    assert.ok(!injected.includes("llm_configs"));
  });

  it("detects missing domain entities vs auth-only MDD", () => {
    const inv = buildDomainInventory({ brdMarkdown: BRD });
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE roles (id UUID PRIMARY KEY);
CREATE TABLE sessions (id UUID PRIMARY KEY);
\`\`\`
`;
    const missing = missingDomainEntities(inv, mdd);
    assert.ok(missing.length >= 2, `expected missing domain entities, got ${missing.join(",")}`);
    const sql = composeDomainTableStubsSql(inv, mdd);
    assert.match(sql, /CREATE TABLE/i);
  });

  it("merges stubs into existing sql fence", () => {
    const inv = buildDomainInventory({ brdMarkdown: BRD });
    const mdd = `# MDD
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`
`;
    const { markdown, injected } = mergeDomainTablesIntoMdd(mdd, inv);
    assert.ok(injected.length > 0);
    assert.match(markdown, /Domain inventory stubs/i);
    assert.match(markdown, /CREATE TABLE users/i);
  });

  it("injects missing DBGA core entity credentials", () => {
    const dbga = `
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE operations (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE credentials (id UUID PRIMARY KEY);
`;
    const mdd = `# MDD
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE strategies (id UUID PRIMARY KEY);
CREATE TABLE operations (id UUID PRIMARY KEY);
CREATE TABLE dashboard_configs (id UUID PRIMARY KEY);
CREATE TABLE otp_sessions (id UUID PRIMARY KEY);
\`\`\`
`;
    const { markdown, injected } = mergeDbgaCoreGapsIntoMdd(mdd, { dbgaMarkdown: dbga });
    assert.deepEqual(injected, ["credentials"]);
    assert.match(markdown, /CREATE TABLE credentials/i);
  });

  it("no append §3 stub cuando SQL sustancial existe pese a (Pendiente) pegado", () => {
    const dbga = `
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE operations (id UUID PRIMARY KEY);
CREATE TABLE credentials (id UUID PRIMARY KEY);
`;
    const mdd = `# MDD
## 3. Modelo de Datos(Pendiente)
\`\`\`sql
CREATE TABLE operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE
);
\`\`\`
`;
    const { markdown, injected } = mergeDbgaCoreGapsIntoMdd(mdd, { dbgaMarkdown: dbga });
    assert.doesNotMatch(markdown, /## 3\. Modelo de Datos\n\n## 3\. Modelo de Datos/);
    assert.doesNotMatch(markdown, /dbga_core_stubs/);
    assert.match(markdown, /CREATE TABLE operations/);
    assert.ok(!injected.includes("operations"));
  });

  it("paso0 stub injection crea attachments con columnas scan_status, no channels", () => {
    const inv = buildDomainInventory({ paso0Catalog });
    const mdd = `# MDD
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`
`;
    const missing = missingDomainEntities(inv, mdd, paso0Catalog);
    assert.ok(missing.includes("attachments"));
    assert.ok(!missing.includes("channels"));
    const sql = composeDomainTableStubsSql(inv, mdd, paso0Catalog);
    assert.match(sql, /CREATE TABLE attachments/i);
    assert.match(sql, /scan_status/i);
    assert.doesNotMatch(sql, /CREATE TABLE channels/i);
    const { markdown, injected } = mergeDomainTablesIntoMdd(mdd, inv, paso0Catalog);
    assert.ok(injected.includes("attachments"));
    assert.match(markdown, /scan_status/i);
  });

  it("paso0 stub injection crea business_events con columnas §3.5 e idempotencia", () => {
    const inv = buildDomainInventory({ paso0Catalog });
    const mdd = `# MDD
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`
`;
    const missing = missingDomainEntities(inv, mdd, paso0Catalog);
    assert.ok(missing.includes("business_events"));
    const sql = composeDomainTableStubsSql(inv, mdd, paso0Catalog);
    assert.match(sql, /CREATE TABLE business_events/i);
    assert.match(sql, /source_application/i);
    assert.match(sql, /event_id/i);
    assert.match(sql, /event_type/i);
    assert.match(sql, /payload JSONB/i);
    assert.match(sql, /occurred_at/i);
    assert.match(sql, /uq_event_dedup UNIQUE \(source_application, event_id\)/i);
    const { markdown, injected } = mergeDomainTablesIntoMdd(mdd, inv, paso0Catalog);
    assert.ok(injected.includes("business_events"));
    assert.match(markdown, /CREATE TABLE business_events/i);
    assert.match(markdown, /source_application/i);
  });
});
