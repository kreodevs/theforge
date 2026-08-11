import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { reconcileMddSsotBeforeDeliveryGate, shouldSkipDestructiveSsotRepair } from "./mdd-ssot-repair.util.js";
import { extractPaso0DecisionCatalog } from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");

const BRD = `
## UAT
**Escenario 1 — Fraccionamiento**
**Escenario 2 — Idempotencia**
**Escenario 3 — Límite IA**
**Escenario 4 — Stop-loss**
`;

const MDD = `
## 1. Contexto
Plataforma MCP con memoria de conversación.

### UAT
**Escenario 1 — Fraccionamiento**
**Escenario 2 — Idempotencia**

## 2. Stack
WebSocket gateway en tiempo real.

## 3. Modelo
\`\`\`sql
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE strategies (id UUID PRIMARY KEY);
CREATE TABLE credentials (id UUID PRIMARY KEY);
CREATE TABLE dashboard_configs (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE mcp_plugins (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| Método | Ruta | Desc | Auth | Notas |
|--------|------|------|------|-------|
| GET | \`/api/v1/health\` | health | — | — |
`;

describe("mdd-ssot-repair.util", () => {
  it("repairs UAT, §4 journeys and platform annotations in one pass", () => {
    const result = reconcileMddSsotBeforeDeliveryGate(MDD, { brdMarkdown: BRD });
    assert.ok(result.uatInjected.length >= 2);
    assert.ok(result.section4Injected.length > 0);
    assert.ok(result.platformAnnotated.includes("mcp_plugins"));
    assert.match(result.markdown, /Escenario 4/i);
    assert.match(result.markdown, /dashboards\/me/);
    assert.match(result.markdown, /\[platform:mcp_plugins\]/);
    assert.equal(result.remainingGaps.length, 0, result.remainingGaps.join("; "));
  });

  it("injects missing credentials stub before gate", () => {
    const dbga = `
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE credentials (id UUID PRIMARY KEY);
`;
    const mdd = `
## 3. Modelo
\`\`\`sql
CREATE TABLE watchlists (id UUID PRIMARY KEY);
CREATE TABLE strategies (id UUID PRIMARY KEY);
CREATE TABLE operations (id UUID PRIMARY KEY);
CREATE TABLE dashboard_configs (id UUID PRIMARY KEY);
CREATE TABLE otp_sessions (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`
`;
    const result = reconcileMddSsotBeforeDeliveryGate(mdd, { dbgaMarkdown: dbga });
    assert.ok(result.section3Injected.includes("credentials"));
    assert.match(result.markdown, /CREATE TABLE credentials/i);
  });

  it("no re-inyecta tablas plataforma tras merge inventario en KMS", () => {
    const brd = `
## 3. Capacidades
### 3.1 Gestión de claves
Rotación de claves y secretos corporativos. Sin chat ni MCP.
`;
    const mdd = `
## 1. Contexto
KMS interno. Sin chat ni MCP.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE keys (id UUID PRIMARY KEY);
CREATE TABLE secrets (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| Método | Ruta | Desc |
|--------|------|------|
| GET | \`/api/v1/keys\` | listar |
`;
    const result = reconcileMddSsotBeforeDeliveryGate(mdd, { brdMarkdown: brd });
    assert.doesNotMatch(result.markdown, /CREATE TABLE channels/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE llm_configs/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE mcp_plugins/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE requests/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE agent_runs/i);
    assert.ok(
      !result.section3Injected.some((e) =>
        ["channels", "llm_configs", "mcp_plugins", "requests", "agent_runs"].includes(e),
      ),
    );
  });

  it("con catálogo Paso 0 elimina tablas prohibidas y no inyecta DBGA core trading", () => {
    const catalog = extractPaso0DecisionCatalog(readFileSync(join(repoRoot, "STEP_0-review.md"), "utf8"));
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`
`;
    const result = reconcileMddSsotBeforeDeliveryGate(mdd, { paso0Catalog: catalog });
    assert.doesNotMatch(result.markdown, /CREATE TABLE channels/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE watchlists/i);
    assert.doesNotMatch(result.markdown, /\/api\/v1\/watchlists/i);
    assert.ok(result.paso0Stripped.includes("channels"));
    assert.ok(result.remainingGaps.some((g) => g.includes("[Paso 0")));
    assert.ok(Array.isArray(result.paso0StrippedRoutes));
    assert.ok(Array.isArray(result.paso0MissingCanonical));
    assert.ok(Array.isArray(result.paso0Gaps));
  });

  it("shouldSkipDestructiveSsotRepair omite strip plataforma cuando faltan muchas entidades Paso 0", () => {
    const catalog = extractPaso0DecisionCatalog(readFileSync(join(repoRoot, "STEP_0-review.md"), "utf8"));
    const sparse = "## 3. Modelo\n```sql\nCREATE TABLE applications (id UUID PRIMARY KEY);\n```\n";
    const guard = shouldSkipDestructiveSsotRepair(sparse, catalog);
    assert.equal(guard.skip, true);
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`
`;
    const result = reconcileMddSsotBeforeDeliveryGate(mdd, { paso0Catalog: catalog });
    assert.doesNotMatch(result.markdown, /CREATE TABLE channels/i);
    assert.match(result.markdown, /CREATE TABLE contexts/i);
  });
});
