import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectMissingPaso0CanonicalTables,
  collectPaso0DeliveryGateBlockers,
  enforcePaso0CatalogOnMdd,
  injectMissingPaso0CanonicalStubsIntoMdd,
  listPaso0TablesToStripFromSection3,
  repairAndInjectPaso0Section3ForGate,
  replaceSection3SqlWithPaso0CanonicalStubs,
  shouldReplaceSection3WithPaso0Canonical,
  detectSection3DuplicateCreateTableNames,
  dedupeSection3ToSingleCanonicalFence,
  repairSection3SqlSyntax,
  dedupeColumnsWithinCreateTableSql,
  replaceCorruptPaso0ApprovalTablesInSql,
  stripOrphanOAuthCallbackBlocksFromSection4,
  sanitizeSection3SqlStructure,
  stripPaso0ForbiddenApiRoutesFromSection4,
  stripPaso0TablesFromSection3Sql,
  normalizePaso0IngestEventsRouteAliases,
  normalizePaso0BreakGlassRouteAliases,
  stripPaso0ForbiddenCoherenceAutoRoutesFromSection4,
  detectPaso0LocalAuthPatterns,
  expandPaso0GlossaryPlaceholdersInSection1,
  expandGlossaryFromPaso0Catalog,
  sanitizeHashPipeTableRowCorruption,
  detectPaso0Section3SqlSyntaxErrors,
  repairPaso0Section4Content,
  sanitizeSection5EdgeCaseTableRows,
  sanitizePaso0StranglerPatternsInBody,
  detectPaso0Section4JsonCorruption,
  sanitizePaso0StranglerFigInMdd,
  areOnlyStranglerFigPaso0Blockers,
  stripPaso0DbgaLeakFromSection1,
  normalizePaso0BreakGlassSingleApproverInSection4,
  normalizePaso0BreakGlassSingleApproverInSection6,
  sanitizePaso0SecurityEventsReferencesInSection6,
  sanitizePaso0MfaTotpInMdd,
  sanitizePaso0StranglerInGovernanceSection,
  sanitizePaso0Section1MvpAlignment,
  sanitizePaso0InventedSlosInSection2,
  sanitizePaso0DualApprovalInSection3,
  ensurePaso0Section2StackProposalFraming,
  detectPaso0Section6PlaceholderBlocker,
  sanitizePaso0ErDiagramContent,
  regenerateAndSanitizePaso0Section3ErDiagram,
  normalizePaso0Section3Layout,
} from "./mdd-paso0-enforcement.util.js";
import { paso0CanonicalCreateTableStub } from "./paso0-canonical-ddl-stubs.util.js";
import {
  deduplicateCanonicalMddSections,
  mddHasDuplicateSectionHeadings,
} from "../ai-analysis/utils/mdd-sanitize/section-merge.js";
import { sanitizeSection4JsonBlocksForDelivery } from "../ai-analysis/utils/mdd-sanitize/contratos-format.js";
import { extractPaso0DecisionCatalog } from "../ai-analysis/phase0/paso0-pasted-definitive.util.js";
import { enrichPaso0DecisionCatalog } from "@theforge/shared-types";
import {
  ensureMddGovernanceSection,
  updateMddGovernancePatterns,
  MDD_GOVERNANCE_WIZARD_BODY,
} from "@theforge/shared-types";
import { deselectStranglerFigInGovernanceWizard } from "./mdd-paso0-trazabilidad.util.js";
import { regenerateErDiagramFromSql } from "../ai-analysis/utils/mdd-diagram-suggestions.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");
const step0Path = join(repoRoot, "STEP_0-review.md");

function loadCatalog() {
  return extractPaso0DecisionCatalog(readFileSync(step0Path, "utf8"));
}

const MDD_WITH_INVENTED = `
## 1. Contexto
- \`channels\` para mensajería corporativa
- \`contexts\` como unidad de colaboración

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE conversations (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE topics (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
CREATE TABLE llm_configs (id UUID PRIMARY KEY);
CREATE TABLE agent_runs (id UUID PRIMARY KEY);
CREATE TABLE calendarios (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`

\`\`\`mermaid
erDiagram
  channels ||--o{ conversations : has
  contexts ||--o{ topics : has
\`\`\`

## 4. Contratos de API
| Método | Ruta | Desc |
|--------|------|------|
| GET | \`/api/v1/channels\` | listar |
| GET | \`/api/v1/contexts\` | listar |
`;

describe("mdd-paso0-enforcement.util", () => {
  it("listPaso0TablesToStripFromSection3 incluye prohibidas e inventadas no canónicas", () => {
    const catalog = loadCatalog();
    const strip = listPaso0TablesToStripFromSection3(catalog);
    assert.ok(strip.includes("channels"));
    assert.ok(strip.includes("conversations"));
    assert.ok(strip.includes("llm_configs"));
    assert.ok(strip.includes("calendarios"));
    assert.ok(!strip.includes("contexts"));
    assert.ok(!strip.includes("messages"));
  });

  it("listPaso0TablesToStripFromSection3 incluye security_events y refresh_tokens con SSO (D-003)", () => {
    const catalog = loadCatalog();
    const strip = listPaso0TablesToStripFromSection3(catalog);
    assert.ok(strip.includes("refresh_tokens"));
    assert.ok(strip.includes("security_events"));
  });

  it("stripPaso0TablesFromSection3Sql elimina CREATE TABLE prohibidos", () => {
    const catalog = loadCatalog();
    const sql = `
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE llm_configs (id UUID PRIMARY KEY);
`;
    const { sql: out, stripped } = stripPaso0TablesFromSection3Sql(
      sql,
      listPaso0TablesToStripFromSection3(catalog),
    );
    assert.deepEqual(stripped.sort(), ["channels", "llm_configs"].sort());
    assert.doesNotMatch(out, /CREATE TABLE channels/i);
    assert.match(out, /CREATE TABLE contexts/i);
  });

  it("enforcePaso0CatalogOnMdd limpia §3, ER, §4 y reporta faltantes", () => {
    const catalog = loadCatalog();
    const result = enforcePaso0CatalogOnMdd(MDD_WITH_INVENTED, catalog);
    assert.doesNotMatch(result.markdown, /CREATE TABLE channels/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE llm_configs/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE calendarios/i);
    assert.match(result.markdown, /CREATE TABLE contexts/i);
    assert.doesNotMatch(result.markdown, /channels \|\|--o\{/i);
    assert.doesNotMatch(result.markdown, /\/api\/v1\/channels/i);
    assert.ok(result.strippedTables.length >= 4);
    assert.ok(result.missingCanonical.length === 0 || result.gaps.some((g) => g.includes("Entidades canónicas ausentes")));
    assert.ok(result.gaps.some((g) => g.includes("[Paso 0 §3]")));
  });

  it("stripPaso0ForbiddenApiRoutesFromSection4 elimina /tenants, /channels y rutas plataforma", () => {
    const body = `
| GET | \`/api/v1/tenants\` | list |
| GET | \`/api/v1/contexts\` | list |
| POST | /api/v1/channels | create |
| GET | \`/api/v1/llm-configs\` | list |
| GET | \`/api/v1/agent-runs\` | list |
| GET | \`/api/v1/mcp-plugins\` | list |
| GET | \`/api/v1/requests\` | list |
`;
    const { body: out, strippedRoutes } = stripPaso0ForbiddenApiRoutesFromSection4(body);
    assert.ok(strippedRoutes.length >= 6);
    assert.doesNotMatch(out, /tenants/i);
    assert.doesNotMatch(out, /llm-configs/i);
    assert.doesNotMatch(out, /agent-runs/i);
    assert.match(out, /contexts/i);
  });

  it("stripPaso0ForbiddenApiRoutesFromSection4 elimina auth local cuando catálogo exige SSO (D-003)", () => {
    const catalog = loadCatalog();
    const body = `
| POST | \`/auth/login\` | Login local |
| POST | \`/auth/register\` | Registro |
| POST | \`/register\` | Alta usuario |
| GET | \`/auth/jwks\` | JWKS |
| GET | \`/api/v1/contexts\` | list |
`;
    const { body: out, strippedRoutes } = stripPaso0ForbiddenApiRoutesFromSection4(body, catalog);
    assert.ok(strippedRoutes.length >= 3);
    assert.doesNotMatch(out, /auth\/login/i);
    assert.doesNotMatch(out, /auth\/register/i);
    assert.doesNotMatch(out, /\/register/i);
    assert.doesNotMatch(out, /auth\/jwks/i);
    assert.match(out, /contexts/i);
  });

  it("stripPaso0ForbiddenApiRoutesFromSection4 elimina callback/refresh/logout/sso y headings ###", () => {
    const catalog = loadCatalog();
    const body = `
### POST /auth/callback
OAuth callback handler.

| POST | \`/auth/refresh\` | Refresh |
| GET | \`/auth/user\` | Perfil |
| POST | \`/auth/sso/login\` | SSO bridge |
| GET | \`/auth/jwks\` | JWKS |
`;
    const { body: out, strippedRoutes } = stripPaso0ForbiddenApiRoutesFromSection4(body, catalog);
    assert.ok(strippedRoutes.length >= 4);
    assert.doesNotMatch(out, /auth\/callback/i);
    assert.doesNotMatch(out, /auth\/refresh/i);
    assert.doesNotMatch(out, /auth\/user/i);
    assert.doesNotMatch(out, /auth\/sso/i);
    assert.doesNotMatch(out, /auth\/jwks/i);
  });

  it("repairSection3SqlSyntax corrige typos e índices embebidos/duplicados", () => {
    const sql = `
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  is default BOOLEAN NOT NULL DEFAULT false,
  content text TEXT NOT NULL
);

CREATE TABLE notification_intents (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL,
CREATE INDEX idx_notif_topic ON notification_intents (topic_id);
  recipient_id UUID NOT NULL
);

CREATE INDEX idx_notif_topic ON notification_intents (topic_id);
CREATE INDEX idx_notif_topic ON notification_intents (topic_id);
`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /is_default/i);
    assert.doesNotMatch(out, /\bis default\b/i);
    assert.match(out, /content_text TEXT/i);
    assert.doesNotMatch(out, /content text TEXT/i);
    assert.equal((out.match(/CREATE INDEX idx_notif_topic/gi) ?? []).length, 1);
    const notifBlock = out.match(/CREATE TABLE notification_intents[\s\S]*?\);/)?.[0] ?? "";
    assert.doesNotMatch(notifBlock, /CREATE INDEX/);
  });

  it("dedupeColumnsWithinCreateTableSql elimina approved_by duplicado y FK users", () => {
    const sql = `
CREATE TABLE break_glass_requests (
  id UUID PRIMARY KEY,
  requested_by UUID NOT NULL,
  approved_by UUID REFERENCES identities(id),
  approved_by UUID REFERENCES identities(id),
  CONSTRAINT chk_break_glass_approvers CHECK (approved_by IS NULL OR approved_by IS NULL OR approved_by <> approved_by)
);

CREATE TABLE export_requests (
  id UUID PRIMARY KEY,
  requested_by UUID NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id)
);
`;
    const out = dedupeColumnsWithinCreateTableSql(sql);
    assert.equal((out.match(/\bapproved_by\b/gi) ?? []).length, 2);
    assert.doesNotMatch(out, /REFERENCES\s+users/i);
    assert.doesNotMatch(out, /chk_break_glass_approvers/i);
  });

  it("replaceCorruptPaso0ApprovalTablesInSql sustituye tablas corruptas por stub canónico", () => {
    const sql = `
CREATE TABLE export_requests (
  id UUID PRIMARY KEY,
  requested_by UUID NOT NULL,
  approved_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  y checksums storage_key VARCHAR(512)
);
`;
    const out = replaceCorruptPaso0ApprovalTablesInSql(sql);
    assert.match(out, /CREATE TABLE export_requests/i);
    assert.doesNotMatch(out, /REFERENCES\s+users/i);
    assert.equal((out.match(/\bapproved_by\b/gi) ?? []).length, 1);
  });

  it("stripOrphanOAuthCallbackBlocksFromSection4 elimina bloque refreshToken huérfano", () => {
    const body = `
### GET /api/v1/health
OK

---

| Parámetro | Tipo |
| code | string |

**Response 200:**
\`\`\`json
{ "accessToken": "x", "refreshToken": "y" }
\`\`\`

---

### POST /api/v1/applications
Create app
`;
    const out = stripOrphanOAuthCallbackBlocksFromSection4(body);
    assert.match(out, /GET \/api\/v1\/health/);
    assert.match(out, /POST \/api\/v1\/applications/);
    assert.doesNotMatch(out, /refreshToken/);
  });

  it("collectPaso0DeliveryGateBlockers bloquea rutas auth prohibidas y §6 SSO contradictorio", () => {
    const catalog = loadCatalog();
    const mdd = `
## 6. Seguridad
- Hash bcrypt de contraseñas de usuario en tabla users.
- MFA TOTP propio para administradores.

## 4. Contratos de API
| POST | \`/auth/refresh\` | Refresh token |
| GET | \`/auth/jwks\` | JWKS OK |
`;
    const blockers = collectPaso0DeliveryGateBlockers(mdd, catalog);
    assert.ok(blockers.some((b) => b.includes("auth/refresh")));
    assert.ok(blockers.some((b) => b.includes("§6") || b.includes("D-003")));
    assert.ok(blockers.some((b) => b.includes("auth/jwks")));
  });

  it("enforcePaso0CatalogOnMdd sanea §6 SSO, Strangler §2 y glosario §1", () => {
    const catalog = loadCatalog();
    const entity = enrichPaso0DecisionCatalog(catalog).entities.find((e) =>
      /^contexto$/i.test(e.term.replace(/\*\*/g, "").trim()),
    );
    const term = entity?.term.replace(/\*\*/g, "").trim() ?? "Contexto";
    const mdd = `
## 1. Contexto
### Glosario de dominio
- **${term}:** término del dominio descrito en el alcance.

## 2. Arquitectura y Stack
- Patrón Strangler Fig para convivencia operativa permanente con Teams.

## 6. Seguridad
- Se almacena refresh_tokens por usuario con bcrypt.
`;
    const result = enforcePaso0CatalogOnMdd(mdd, catalog);
    assert.doesNotMatch(result.markdown, /bcrypt/i);
    assert.doesNotMatch(result.markdown, /Patrón Strangler Fig|estrangulamiento incremental/i);
    assert.doesNotMatch(result.markdown, /término del dominio descrito en el alcance/i);
    assert.match(result.markdown, /D-121|convivencia operativa permanente/i);
  });

  it("normalizePaso0BreakGlassRouteAliases unifica variantes break-glass", () => {
    const { body } = normalizePaso0BreakGlassRouteAliases(
      "| POST | `/break-glass/requests` | bg |",
    );
    assert.match(body, /`\/break-glass-requests`/);
  });

  it("expandPaso0GlossaryPlaceholdersInSection1 usa definiciones del catálogo", () => {
    const catalog = loadCatalog();
    const mockCatalog = {
      ...catalog,
      entities: [
        ...(catalog.entities ?? []),
        { term: "Contexto", definition: "Entidad de negocio alrededor de la cual se colabora", decisionIds: ["D-002"] },
      ],
    };
    const input = "- **Contexto:** término del dominio descrito en el alcance.";
    const { body, expanded } = expandPaso0GlossaryPlaceholdersInSection1(input, mockCatalog);
    assert.ok(expanded.length >= 1);
    assert.doesNotMatch(body, /término del dominio descrito en el alcance/i);
    assert.match(body, /Entidad (o propósito|de negocio)/i);
  });

  it("detectPaso0LocalAuthPatterns detecta TOTP/bcrypt con SSO", () => {
    const catalog = loadCatalog();
    const warnings = detectPaso0LocalAuthPatterns(
      "## 6. Seguridad\nMFA TOTP propio y tabla refresh_tokens para usuarios.",
      catalog,
    );
    assert.ok(warnings.length >= 1);
  });

  it("enforcePaso0CatalogOnMdd procesa todos los bloques sql en §3", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`

### Extensiones
\`\`\`sql
CREATE TABLE llm_configs (id UUID PRIMARY KEY);
CREATE TABLE agent_runs (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`
`;
    const result = enforcePaso0CatalogOnMdd(mdd, catalog);
    assert.doesNotMatch(result.markdown, /CREATE TABLE channels/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE llm_configs/i);
    assert.doesNotMatch(result.markdown, /CREATE TABLE agent_runs/i);
    assert.match(result.markdown, /CREATE TABLE contexts/i);
    assert.match(result.markdown, /CREATE TABLE messages/i);
  });

  it("collectMissingPaso0CanonicalTables detecta entidades ausentes", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
\`\`\`
`;
    const missing = collectMissingPaso0CanonicalTables(mdd, catalog);
    assert.ok(missing.includes("contexts") || missing.includes("topics") || missing.includes("messages"));
  });

  it("collectPaso0DeliveryGateBlockers bloquea §3 inventada, §4 coherence auto y §2 offline", () => {
    const catalog = loadCatalog();
    const mdd = `
## 2. Arquitectura y Stack
Cliente móvil PWA con Service Worker y cola offline de mensajes.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE llm_configs (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| GET | \`/api/v1/channels\` | list |
| GET | \`/api/v1/contexts\` | list |
| GET | \`/api/v1/channels\` | channels (coherence auto) |
`;
    const blockers = collectPaso0DeliveryGateBlockers(mdd, catalog);
    assert.ok(blockers.some((b) => b.includes("llm_configs")));
    assert.ok(blockers.some((b) => b.includes("coherence auto")));
    assert.ok(blockers.some((b) => b.includes("D-088") || b.includes("offline")));
  });

  it("collectPaso0DeliveryGateBlockers bloquea business_events ausente en §3", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
| POST | \`/attachments\` | upload |
| GET | \`/ws\` | realtime |
| POST | \`/break-glass-requests\` | bg |
| POST | \`/migration-jobs\` | mig |
`;
    const blockers = collectPaso0DeliveryGateBlockers(mdd, catalog);
    assert.ok(blockers.some((b) => b.includes("business_events")));
  });

  it("collectPaso0DeliveryGateBlockers bloquea POST /ingest/events ausente", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE business_events (id UUID PRIMARY KEY);
CREATE TABLE attachments (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| GET | \`/api/v1/contexts\` | list |
| POST | \`/attachments\` | upload |
| GET | \`/ws\` | realtime |
| POST | \`/break-glass-requests\` | bg |
| POST | \`/migration-jobs\` | mig |
`;
    const blockers = collectPaso0DeliveryGateBlockers(mdd, catalog);
    assert.ok(blockers.some((b) => b.includes("ingest") || b.includes("Ingesta")));
  });

  it("enforcePaso0CatalogOnMdd inyecta POST /ingest/events cuando faltan rutas MVP críticas", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE business_events (id UUID PRIMARY KEY);
CREATE TABLE attachments (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| Método | Ruta | Desc |
|--------|------|------|
| POST | \`/attachments\` | upload |
| GET | \`/ws\` | realtime |
| POST | \`/break-glass-requests\` | bg |
| POST | \`/migration-jobs\` | mig |
`;
    const result = enforcePaso0CatalogOnMdd(mdd, catalog);
    assert.match(result.markdown, /POST[^\\n]*`\/ingest\/events`/i);
    assert.ok(result.paso0RoutesInjected.includes("ingest-events"));
    const blockers = collectPaso0DeliveryGateBlockers(result.markdown, catalog);
    assert.ok(!blockers.some((b) => b.includes("ingest") || b.includes("Ingesta")));
  });

  it("paso0Final tras inyección ER elimina entidades prohibidas del diagrama", () => {
    const catalog = loadCatalog();
    const sql = `
CREATE TABLE channels (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
`;
    const draft = `## 3. Modelo de Datos\n\n\`\`\`sql\n${sql}\n\`\`\`\n`;
    const withEr = regenerateErDiagramFromSql(draft, { paso0Catalog: catalog }) ?? draft;
    const result = enforcePaso0CatalogOnMdd(withEr, catalog);
    assert.doesNotMatch(result.markdown, /\bchannels\b/i);
    assert.match(result.markdown, /\bcontexts\b/i);
    assert.doesNotMatch(result.markdown, /channels \|\|--o\{/i);
  });

  it("sanitizeSection3SqlStructure deduplica CREATE TABLE duplicado (security_events)", () => {
    const sql = `
CREATE TABLE security_events (
  id UUID PRIMARY KEY,
  action VARCHAR(80) NOT NULL
);

CREATE TABLE contexts (id UUID PRIMARY KEY);

CREATE TABLE security_events (
  id UUID PRIMARY KEY,
  action VARCHAR(80) NOT NULL,
  actor_id UUID
);
`;
    const out = sanitizeSection3SqlStructure(sql);
    assert.equal((out.match(/CREATE TABLE security_events/gi) ?? []).length, 1);
    assert.match(out, /CREATE TABLE contexts/i);
    assert.doesNotMatch(out, /actor_id UUID/);
  });

  it("sanitizeSection3SqlStructure repara CREATE TABLE embebido (analytics_rollups)", () => {
    const sql = `
CREATE TABLE analytics_rollups (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL,
  metric_key VARCHAR(120) NOT NULL,
CREATE TABLE security_events (
  id UUID PRIMARY KEY,
  action VARCHAR(80) NOT NULL
);
  bucket_start TIMESTAMPTZ NOT NULL
);
`;
    const out = sanitizeSection3SqlStructure(sql);
    assert.match(out, /CREATE TABLE analytics_rollups/i);
    assert.match(out, /CREATE TABLE security_events/i);
    assert.equal((out.match(/CREATE TABLE analytics_rollups/gi) ?? []).length, 1);
    assert.equal((out.match(/CREATE TABLE security_events/gi) ?? []).length, 1);
    const rollupsBlock = out.match(/CREATE TABLE analytics_rollups[\s\S]*?\);/)?.[0] ?? "";
    assert.doesNotMatch(rollupsBlock, /CREATE TABLE security_events/);
  });

  it("enforcePaso0CatalogOnMdd sanea duplicados y anidamiento en todos los bloques sql", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE audit_entries (id UUID PRIMARY KEY, action VARCHAR(80));
CREATE TABLE audit_entries (id UUID PRIMARY KEY, action VARCHAR(80), actor_id UUID);
CREATE TABLE analytics_rollups (
  id BIGSERIAL PRIMARY KEY,
  metric_key VARCHAR(120) NOT NULL,
CREATE TABLE contexts (id UUID PRIMARY KEY);
  bucket_start TIMESTAMPTZ NOT NULL
);
\`\`\`
`;
    const result = enforcePaso0CatalogOnMdd(mdd, catalog);
    assert.equal((result.markdown.match(/CREATE TABLE audit_entries/gi) ?? []).length, 1);
    assert.doesNotMatch(result.markdown, /actor_id UUID/);
    assert.match(result.markdown, /CREATE TABLE contexts/i);
    assert.match(result.markdown, /CREATE TABLE analytics_rollups/i);
    const rollupsBlock =
      result.markdown.match(/CREATE TABLE analytics_rollups[\s\S]*?\);/)?.[0] ?? "";
    assert.doesNotMatch(rollupsBlock, /CREATE TABLE contexts/);
  });

  it("normalizePaso0IngestEventsRouteAliases convierte POST /events a /ingest/events", () => {
    const { body, normalized } = normalizePaso0IngestEventsRouteAliases(
      "| POST | `/events` | ingest | auth | D-080 |",
    );
    assert.match(body, /`\/ingest\/events`/);
    assert.ok(normalized.includes("/events→/ingest/events"));
  });

  it("stripPaso0ForbiddenCoherenceAutoRoutesFromSection4 elimina requests coherence auto", () => {
    const catalog = loadCatalog();
    const body = `
| GET | \`/api/v1/requests\` | requests (coherence auto) |
| GET | \`/api/v1/contexts\` | list |
`;
    const { body: out, stripped } = stripPaso0ForbiddenCoherenceAutoRoutesFromSection4(body, catalog);
    assert.ok(stripped.some((s) => s.includes("requests")));
    assert.doesNotMatch(out, /coherence auto.*requests/i);
    assert.match(out, /contexts/i);
  });

  it("stripPaso0ForbiddenCoherenceAutoRoutesFromSection4 elimina request (singular) coherence auto", () => {
    const catalog = loadCatalog();
    const body = `
| GET | \`/api/v1/request\` | request (coherence auto) |
| GET | \`/api/v1/contexts\` | list |
`;
    const { body: out, stripped } = stripPaso0ForbiddenCoherenceAutoRoutesFromSection4(body, catalog);
    assert.ok(stripped.some((s) => s.includes("request")));
    assert.doesNotMatch(out, /coherence auto.*request/i);
    assert.match(out, /contexts/i);
  });

  it("repairSection3SqlSyntax corrige query text, purge_tombstones e índice idempotency_key", () => {
    const sql = `
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  query text TEXT NOT NULL,
  content text TEXT NOT NULL
);
CREATE TABLE purge_tombstones (
  id BIGSERIAL PRIMARY KEY,
  purged_by o UUID de identity reason TEXT,
  policy_version INTEGER NOT NULL
);
CREATE INDEX idx_business_events_idempotency ON business_events (idempotency_key);
CREATE TABLE business_events (
  id UUID PRIMARY KEY,
  source_application VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  CONSTRAINT uq_event_dedup UNIQUE (source_application, event_id)
);
`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /query_text TEXT/i);
    assert.match(out, /content_text TEXT/i);
    assert.doesNotMatch(out, /purged_by o UUID de identity/i);
    assert.doesNotMatch(out, /CREATE\s+INDEX\s+idx_business_events_idempotency/i);
    assert.match(out, /uq_event_dedup/i);
  });

  it("repairPaso0Section4Content repara JSON pegado y elimina placeholder §4", () => {
    const body = `
(Pendiente: paso dedicado Lógica y Edge Cases)

| POST | \`/break-glass-requests\` | bg |
| POST | \`/break-glass-requests\` | dup |

\`\`\`json
{ "data": [], { "errors": [," }
\`\`\`
`;
    const { body: fixed, fixed: tags } = repairPaso0Section4Content(body);
    assert.ok(tags.includes("§4-placeholder-removed"));
    assert.ok(tags.includes("§4-dedupe-routes"));
    assert.ok(
      tags.some((t) => t.startsWith("§4-json")),
      `expected §4-json* repair tags got ${tags.join(",")}`,
    );
    assert.doesNotMatch(fixed, /Pendiente: paso dedicado/i);
    assert.equal((fixed.match(/break-glass-requests/gi) ?? []).length, 1);
    assert.equal(detectPaso0Section4JsonCorruption(fixed).length, 0);
  });

  it("sanitizeSection4JsonBlocksForDelivery conserva JSON válido sin placeholder", () => {
    const valid = `\`\`\`json
{
  "request": { "topicId": "550e8400-e29b-41d4-a716-446655440000" },
  "response": { "status": "ok", "data": { "id": "550e8400-e29b-41d4-a716-446655440000" } }
}
\`\`\``;
    const { body: fixed, fixed: tags } = sanitizeSection4JsonBlocksForDelivery(valid);
    assert.ok(!tags.includes("§4-json-placeholder"));
    assert.match(fixed, /topicId/);
    assert.doesNotMatch(fixed, /placeholder — reparación determinista/i);
  });

  it("sanitizeSection4JsonBlocksForDelivery repara data vacío pegado sin placeholder", () => {
    const body = `\`\`\`json
{ "response": { "data": [], { "errors": [ { "code": "x" } ] } } }
\`\`\``;
    const { body: fixed, fixed: tags } = sanitizeSection4JsonBlocksForDelivery(body);
    assert.ok(!tags.includes("§4-json-placeholder"));
    assert.ok(tags.some((t) => t.startsWith("§4-json")));
    assert.doesNotMatch(fixed, /placeholder — reparación determinista/i);
    assert.equal(detectPaso0Section4JsonCorruption(fixed).length, 0);
  });

  it("repairSection3SqlSyntax renombra content text a content_text", () => {
    const sql = `CREATE TABLE messages (id UUID PRIMARY KEY, content text NOT NULL);`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /content_text/);
    assert.doesNotMatch(out, /\bcontent text\b/i);
  });

  it("repairSection3SqlSyntax renombra default BOOLEAN reservado a is_default", () => {
    const sql = `CREATE TABLE flags (id UUID PRIMARY KEY, default BOOLEAN NOT NULL DEFAULT false);`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /is_default BOOLEAN/i);
    assert.doesNotMatch(out, /\bdefault BOOLEAN\b/i);
    assert.equal(detectPaso0Section3SqlSyntaxErrors(`\`\`\`sql\n${out}\n\`\`\``).length, 0);
  });

  it("deduplicateCanonicalMddSections elimina §7 duplicada tras acumulación del pipeline", () => {
    const draft = `
# Master Design Document

## 1. Contexto
Alcance MVP.

## 2. Arquitectura y Stack
NestJS + PostgreSQL.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |

## 5. Lógica y Edge Cases
Reglas de negocio sustanciales para dedupe canónico del job 135 con contenido mínimo válido en la sección cinco del documento de diseño maestro corporativo. `.repeat(3);

    const duplicateTail = `
## 6. Seguridad
SSO OIDC.

## 7. Infraestructura
Primera §7 buena con manifest y despliegue HA en Kubernetes con PostgreSQL gestionado y Redis para pub/sub en entorno productivo.

## 7. Infraestructura
Segunda §7 duplicada por DiagramInjector/Formatter.

## 4. Contratos de API
| GET | \`/api/v1/dup\` | duplicado |
`;
    const raw = `${draft}${duplicateTail}`;
    assert.ok(mddHasDuplicateSectionHeadings(raw));
    const out = deduplicateCanonicalMddSections(raw);
    assert.strictEqual(mddHasDuplicateSectionHeadings(out), false);
    assert.equal((out.match(/^##\s+7\./gim) ?? []).length, 1);
    assert.doesNotMatch(out, /Segunda §7 duplicada/);
  });

  it("expandGlossaryFromPaso0Catalog expande placeholders Capacidades e Instrucciones", () => {
    const catalog = loadCatalog();
    const mdd = `
## 1. Contexto
### Glosario de dominio
- **Capacidades de negocio (MVP)::** término del dominio descrito en el alcance.
- **Instrucciones para agentes::** término del dominio descrito en el alcance.
`;
    const { markdown, expanded } = expandGlossaryFromPaso0Catalog(mdd, catalog);
    assert.ok(expanded.length >= 2);
    assert.doesNotMatch(markdown, /término del dominio descrito en el alcance/i);
    assert.match(markdown, /Capacidades de negocio|MVP/i);
    assert.match(markdown, /Instrucciones para agentes|agentes de IA/i);
  });

  it("sanitizeHashPipeTableRowCorruption corrige fila §2 con prefijo # |", () => {
    const body = `| Principio | Detalle |
| # | **Auditoría inmodificable** | append-only |`;
    const out = sanitizeHashPipeTableRowCorruption(body);
    assert.match(out, /^\| \*\*Auditoría inmodificable\*\*/m);
    assert.doesNotMatch(out, /^\s*#\s*\|\s*\*\*Auditoría/m);
  });

  it("sanitizeSection4JsonBlocksForDelivery sustituye JSON irrecuperable por placeholder parseable", () => {
    const body = `\`\`\`json
{ not valid json at all :::
\`\`\``;
    const { body: fixed, fixed: tags } = sanitizeSection4JsonBlocksForDelivery(body);
    assert.ok(tags.includes("§4-json-placeholder"));
    assert.doesNotMatch(fixed, /not valid json at all/i);
    assert.doesNotMatch(fixed, /"request"\s*:\s*\{\s*"note":\s*"contract stub/i);
    assert.equal(detectPaso0Section4JsonCorruption(fixed).length, 0);
  });

  it("repairSection3SqlSyntax corrige objetos_checksum e is default", () => {
    const sql = `
CREATE TABLE attachments (id UUID PRIMARY KEY, objetos_checksum VARCHAR(64));
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY,
  is default BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE analytics_rollups (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL,
  metric_key VARCHAR(120) NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_rollup UNIQUE (application_id, metric_key, period_start)
);
`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /\bchecksum\b/i);
    assert.doesNotMatch(out, /objetos_checksum/i);
    assert.match(out, /is_default BOOLEAN/i);
    assert.match(out, /bucket_start/i);
    assert.doesNotMatch(out, /\bperiod_start\b/i);
  });

  it("repairPaso0Section4Content dedupe GET attachments :id vs :attachmentId", () => {
    const body = `
| GET | \`/attachments/:id\` | by id |
| GET | \`/attachments/:attachmentId\` | dup |
`;
    const { body: fixed, fixed: tags } = repairPaso0Section4Content(body);
    assert.ok(tags.includes("§4-dedupe-routes"));
    assert.equal((fixed.match(/GET[^\\n]*attachments/gi) ?? []).length, 1);
  });

  it("repairAndInjectPaso0Section3ForGate inyecta business_events; autofix regenera ER", async () => {
    const catalog = loadCatalog();
    const { applyDeterministicDeliveryGateAutofixes } = await import(
      "../ai-analysis/utils/mdd-delivery-gate-autofix.util.js"
    );
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`

\`\`\`mermaid
erDiagram
  applications {
    uuid id PK
  }
  contexts {
    uuid id PK
  }
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
`;
    const autofixed = applyDeterministicDeliveryGateAutofixes(mdd, { paso0Catalog: catalog });
    assert.ok(autofixed.applied.some((a) => a.includes("business_events")));
    assert.match(autofixed.markdown, /CREATE TABLE business_events/i);
    assert.ok(autofixed.applied.includes("§3-er-regen"));
    const erBlock = autofixed.markdown.match(/```mermaid[\s\S]*?```/)?.[0] ?? "";
    assert.match(erBlock, /business_events/i);
  });

  it("persist gate path: JSON corrupto en §4 se repara con enforcePaso0CatalogOnMdd", () => {
    const catalog = loadCatalog();
    const mdd = `
## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |

\`\`\`json
{ "request": { "x": 1 }, "response": { "data": [], { "errors": [," } }
\`\`\`
`;
    const enforced = enforcePaso0CatalogOnMdd(mdd, catalog);
    const blockers = collectPaso0DeliveryGateBlockers(enforced.markdown, catalog);
    assert.ok(
      !blockers.some((b) => b.includes("```json inválido")),
      blockers.join("; "),
    );
  });

  it("sanitizeSection5EdgeCaseTableRows corrige fila EC-22 comentada", () => {
    const body = `| # | Caso | Tratamiento | D-ID |
| # | EC-22 | Servicio de llaves | aprobada no ejecutable | D-147 |`;
    const out = sanitizeSection5EdgeCaseTableRows(body);
    assert.match(out, /^\| EC-22 \|/m);
    assert.doesNotMatch(out, /^\s*#\s*\|\s*EC-22/m);
  });

  it("detectPaso0Section4JsonCorruption no bloquea tras reparación determinista de arrays pegados", () => {
    const blockers = detectPaso0Section4JsonCorruption(
      '```json\n{ "data": [], { "x": 1 }\n```',
    );
    assert.equal(blockers.length, 0);
  });

  it("sanitizePaso0StranglerPatternsInBody elimina Strangler en §7", () => {
    const catalog = loadCatalog();
    const { body, warnings } = sanitizePaso0StranglerPatternsInBody(
      "- Strangler Fig para migración incremental con Teams.",
      catalog,
      "§7",
    );
    assert.ok(warnings.length >= 1);
    assert.doesNotMatch(body, /Patrón Strangler Fig|estrangulamiento incremental/i);
    assert.match(body, /D-121|corte por campaña/i);
  });

  it("repairAndInjectPaso0Section3ForGate corrige índices embebidos y elimina blockers §3", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  is default BOOLEAN NOT NULL DEFAULT false,
  content text TEXT NOT NULL
);
CREATE TABLE notification_intents (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL,
CREATE INDEX idx_notif_topic ON notification_intents (topic_id);
  recipient_id UUID NOT NULL
);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
| POST | \`/attachments\` | upload |
| GET | \`/ws\` | realtime |
| POST | \`/break-glass-requests\` | bg |
| POST | \`/migration-jobs\` | mig |
`;
    const blockersBefore = collectPaso0DeliveryGateBlockers(mdd, catalog);
    assert.ok(blockersBefore.some((b) => b.includes("SQL con error de sintaxis")));

    const repaired = repairAndInjectPaso0Section3ForGate(mdd, catalog);
    const enforced = enforcePaso0CatalogOnMdd(repaired.markdown, catalog);
    assert.equal(detectPaso0Section3SqlSyntaxErrors(enforced.markdown).length, 0);

    const blockersAfter = collectPaso0DeliveryGateBlockers(enforced.markdown, catalog);
    assert.ok(!blockersAfter.some((b) => b.includes("SQL con error de sintaxis")));
    assert.ok(repaired.applied.some((a) => a.includes("§3-stubs") || a.includes("§3-canonical-replace")));
  });

  it("replaceSection3SqlWithPaso0CanonicalStubs elimina approved_by duplicado y SQL inválido", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
Resumen ER.

\`\`\`mermaid
erDiagram
  applications ||--o{ contexts : has
\`\`\`

\`\`\`sql
CREATE TABLE break_glass_requests (
  id UUID PRIMARY KEY,
  approved_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES identities(id),
  is default BOOLEAN
);
\`\`\`
`;
    const out = replaceSection3SqlWithPaso0CanonicalStubs(mdd, catalog);
    assert.match(out, /```mermaid/);
    assert.doesNotMatch(out, /is default/i);
    assert.doesNotMatch(out, /REFERENCES users/i);
    assert.match(out, /CREATE TABLE break_glass_requests/i);
    assert.equal(detectPaso0Section3SqlSyntaxErrors(out).length, 0);
  });

  it("repairAndInjectPaso0Section3ForGate: §3 sin business_events → autofix → gate sin blocker", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
CREATE TABLE attachments (id UUID PRIMARY KEY);
CREATE TABLE migration_jobs (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
| POST | \`/attachments\` | upload |
| GET | \`/ws\` | realtime |
| POST | \`/break-glass-requests\` | bg |
| POST | \`/migration-jobs\` | mig |
`;
    assert.ok(collectMissingPaso0CanonicalTables(mdd, catalog).includes("business_events"));
    const repaired = repairAndInjectPaso0Section3ForGate(mdd, catalog);
    assert.ok(repaired.applied.some((a) => a.includes("business_events")));
    assert.ok(!collectMissingPaso0CanonicalTables(repaired.markdown, catalog).includes("business_events"));
    const blockers = collectPaso0DeliveryGateBlockers(repaired.markdown, catalog);
    assert.ok(!blockers.some((b) => b.includes("business_events")), blockers.join("; "));
  });

  it("collectMissingPaso0CanonicalTables detecta schema.table business_events", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE public.business_events (id UUID PRIMARY KEY);
\`\`\`
`;
    assert.ok(!collectMissingPaso0CanonicalTables(mdd, catalog).includes("business_events"));
  });

  it("injectMissingPaso0CanonicalStubsIntoMdd inyecta outbox cuando falta", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE business_events (id UUID PRIMARY KEY);
CREATE TABLE migration_jobs (id UUID PRIMARY KEY);
\`\`\`
`;
    assert.ok(collectMissingPaso0CanonicalTables(mdd, catalog).includes("outbox"));
    const { markdown, injected } = injectMissingPaso0CanonicalStubsIntoMdd(mdd, catalog);
    assert.ok(injected.includes("outbox"));
    assert.match(markdown, /CREATE TABLE outbox/i);
    assert.ok(!collectMissingPaso0CanonicalTables(markdown, catalog).includes("outbox"));
  });

  it("injectMissingPaso0CanonicalStubsIntoMdd fusiona stubs en el último bloque sql de §3", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
-- erDiagram snippet
CREATE TABLE applications (id UUID PRIMARY KEY);
\`\`\`
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE business_events (id UUID PRIMARY KEY);
\`\`\`
`;
    assert.ok(collectMissingPaso0CanonicalTables(mdd, catalog).includes("outbox"));
    const { markdown, injected } = injectMissingPaso0CanonicalStubsIntoMdd(mdd, catalog);
    assert.ok(injected.includes("outbox"));
    const section3 = markdown.match(/## 3\. Modelo de Datos[\s\S]*/i)?.[0] ?? "";
    const blocks = [...section3.matchAll(/```sql\s*\n([\s\S]*?)```/gi)].map((m) => m[1] ?? "");
    assert.equal(blocks.length, 2);
    assert.match(blocks[0]!, /CREATE TABLE applications/i);
    assert.match(blocks[1]!, /CREATE TABLE outbox/i);
    assert.ok(!collectMissingPaso0CanonicalTables(markdown, catalog).includes("outbox"));
  });

  it("repairSection3SqlSyntax corrige idx_business_events_context sin context_id", () => {
    const sql = `
CREATE TABLE business_events (id UUID PRIMARY KEY, application_id UUID NOT NULL);
CREATE INDEX idx_business_events_context ON business_events (application_id);
`;
    const out = repairSection3SqlSyntax(sql);
    assert.doesNotMatch(out, /idx_business_events_context/i);
    assert.match(out, /idx_business_events_application/i);
  });

  it("stripPaso0TablesFromSection3Sql elimina whatsapp_devices inventada", () => {
    const catalog = loadCatalog();
    const strip = listPaso0TablesToStripFromSection3(catalog);
    assert.ok(strip.includes("whatsapp_devices"), `strip list: ${strip.join(",")}`);
    const sql = `
CREATE TABLE whatsapp_devices (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY);
`;
    const { sql: out, stripped } = stripPaso0TablesFromSection3Sql(sql, strip);
    assert.ok(stripped.includes("whatsapp_devices"));
    assert.doesNotMatch(out, /CREATE TABLE whatsapp_devices/i);
  });

  it("sanitizePaso0StranglerFigInMdd elimina Strangler en §2/§6/§7 y limpia blockers", () => {
    const catalog = loadCatalog();
    const mdd = `
## 2. Arquitectura y Stack
- Strangler Fig para convivencia operativa con Teams.

## 6. Seguridad
Migración incremental vía Strangler Fig.

## 7. Infraestructura
Patrón Saga + Strangler Fig en runtime.
`;
    const { markdown, warnings } = sanitizePaso0StranglerFigInMdd(mdd, catalog);
    assert.ok(warnings.length >= 2);
    assert.doesNotMatch(markdown, /Strangler Fig para convivencia|vía Strangler Fig|Strangler Fig en runtime/i);
    assert.match(markdown, /D-121|corte por campaña/i);
    const blockers = collectPaso0DeliveryGateBlockers(markdown, catalog);
    assert.ok(!blockers.some((b) => b.includes("Strangler Fig")));
  });

  it("areOnlyStranglerFigPaso0Blockers detecta blockers exclusivos D-121", () => {
    assert.equal(
      areOnlyStranglerFigPaso0Blockers([
        "[Paso 0 §2] Strangler Fig documentado — incompatible con D-121.",
      ]),
      true,
    );
    assert.equal(
      areOnlyStranglerFigPaso0Blockers([
        "[Paso 0 §2] Strangler Fig documentado — incompatible con D-121.",
        "[Paso 0 §3] SQL con error de sintaxis",
      ]),
      false,
    );
  });

  it("stripPaso0DbgaLeakFromSection1 elimina bloque DBGA en Propósito", () => {
    const catalog = loadCatalog();
    const body = `### Propósito
Workspace Chat MVP.

**Entidades y capacidades extraídas del DBGA**
- channels
- tenants

### Glosario
- **Capacidades de negocio (MVP):** término del dominio descrito en el alcance.`;
    const { body: out, warnings } = stripPaso0DbgaLeakFromSection1(body, catalog!);
    assert.ok(warnings.some((w) => w.includes("DBGA")));
    assert.doesNotMatch(out, /Entidades y capacidades extraídas del DBGA/i);
    assert.doesNotMatch(out, /término del dominio descrito en el alcance/i);
  });

  it("normalizePaso0BreakGlassSingleApproverInSection4 elimina approve-first/second", () => {
    const body = `
| POST | \`/break-glass-requests/{id}/approve-first\` | Primera |
| POST | \`/break-glass-requests/{id}/approve-second\` | Segunda |
`;
    const { body: out, normalized } = normalizePaso0BreakGlassSingleApproverInSection4(body);
    assert.ok(normalized.length >= 1);
    assert.doesNotMatch(out, /approve-first/i);
    assert.doesNotMatch(out, /approve-second/i);
    assert.match(out, /break-glass-requests.*\/approve/i);
  });

  it("sanitizePaso0MfaTotpInMdd elimina totp_secret y MFA obligatorio con SSO", () => {
    const catalog = loadCatalog();
    const mdd = `
## 1. Contexto
MFA TOTP obligatorio para todos los usuarios; totp_secret en users.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  totp_secret BYTEA NOT NULL
);
CREATE TABLE mfa_secrets (
  user_id UUID PRIMARY KEY,
  totp_secret VARCHAR(255) NOT NULL
);
\`\`\`

## 6. Seguridad
Hashing Argon2id y TOTP RFC 6238 obligatorio.
`;
    const { markdown, warnings } = sanitizePaso0MfaTotpInMdd(mdd, catalog!);
    assert.ok(warnings.length >= 2);
    assert.doesNotMatch(markdown, /totp_secret BYTEA/i);
    assert.doesNotMatch(markdown, /CREATE TABLE mfa_secrets/i);
    assert.doesNotMatch(markdown, /TOTP RFC 6238 obligatorio/i);
  });

  it("sanitizePaso0SecurityEventsReferencesInSection6 usa audit_entries sin tabla §3", () => {
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE audit_entries (id UUID PRIMARY KEY);
\`\`\`

## 6. Seguridad
Los intentos fallidos se registran en security_events.
`;
    const catalog = loadCatalog();
    const section6 = mdd.match(/## 6\. Seguridad[\s\S]*/)?.[0]?.replace(/^##[^\n]+\n?/, "") ?? "";
    const { body, warnings } = sanitizePaso0SecurityEventsReferencesInSection6(section6, mdd, catalog!);
    assert.ok(warnings.length >= 1);
    assert.match(body, /audit_entries/i);
    assert.doesNotMatch(body, /security_events/i);
  });

  it("enforcePaso0CatalogOnMdd aplica deselect Strangler en wizard SSOT", () => {
    const catalog = loadCatalog();
    let mdd = `# MDD\n\n## 1. Contexto\nD-121 corte por campaña.\n\n## 3. Modelo de Datos\n\`\`\`sql\nCREATE TABLE contexts (id UUID PRIMARY KEY);\nCREATE TABLE messages (id UUID PRIMARY KEY);\n\`\`\`\n\n## 4. Contratos de API\n| POST | \`/ingest/events\` | ingest |\n`;
    mdd = ensureMddGovernanceSection(mdd, "");
    mdd = updateMddGovernancePatterns(mdd, new Set(["strangler-fig-estrangulamiento", "repository"]));
    const result = enforcePaso0CatalogOnMdd(mdd, catalog!);
    assert.doesNotMatch(result.markdown, /\[X\].*Strangler Fig/i);
    assert.match(result.markdown, /\[X\].*Repository/i);
  });

  it("repairSection3SqlSyntax corrige no texto plano scope en application_credentials", () => {
    const sql = `CREATE TABLE application_credentials (
  id UUID PRIMARY KEY,
  no texto plano scope TEXT NOT NULL
);`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /allowed_origins/i);
    assert.doesNotMatch(out, /no texto plano scope/i);
  });

  it("repairSection3SqlSyntax reemplaza ON DELETE CASCADE por RESTRICT", () => {
    const sql = `CREATE TABLE messages (
  id UUID PRIMARY KEY,
  context_id UUID NOT NULL REFERENCES contexts(id) ON DELETE CASCADE
);`;
    const out = repairSection3SqlSyntax(sql);
    assert.match(out, /ON DELETE RESTRICT/i);
    assert.doesNotMatch(out, /ON DELETE CASCADE/i);
  });

  it("sanitizePaso0Section1MvpAlignment corrige E2EE/agente/export posteriores y SLAs inventados", () => {
    const catalog = loadCatalog();
    const body = `
- Implementación de E2EE posterior al MVP.
- Agentes de IA en iteración posterior.
- export_requests no se implementa en MVP.
- Disponibilidad 99.9% y p99 < 200 ms.
- Política de retención: 3 meses, 6 meses, 1 año, 2 años y 5 años.
`;
    const { body: out, warnings } = sanitizePaso0Section1MvpAlignment(body, catalog!);
    assert.ok(warnings.length >= 4);
    assert.match(out, /E2EE configurable.*MVP/i);
    assert.match(out, /Agente externo.*MCP/i);
    assert.match(out, /Legal hold y exportación puntual/i);
    assert.doesNotMatch(out, /99\.9%/i);
    assert.match(out, /35 días/i);
  });

  it("ensurePaso0Section2StackProposalFraming inserta advertencia D-162", () => {
    const catalog = loadCatalog();
    const body = `### 2.3 Stack técnico
PostgreSQL, NestJS y Kong como API gateway.`;
    const { body: out, warnings } = ensurePaso0Section2StackProposalFraming(body, catalog!);
    assert.equal(warnings.length, 1);
    assert.match(out, /D-162/);
    assert.match(out, /propuestas/i);
  });

  it("sanitizePaso0DualApprovalInSection3 normaliza break-glass a approved_by único", () => {
    const catalog = loadCatalog();
    const body = `CREATE TABLE break_glass_requests (
  first_approver_id UUID,
  second_approver_id UUID,
  CONSTRAINT chk_different_approvers CHECK (first_approver_id IS DISTINCT FROM second_approver_id)
);`;
    const { body: out, warnings } = sanitizePaso0DualApprovalInSection3(body, catalog!);
    assert.equal(warnings.length, 1);
    assert.match(out, /approved_by UUID/);
    assert.doesNotMatch(out, /second_approver_id/i);
  });

  it("sanitizePaso0InventedSlosInSection2 elimina filas 99.9% y p99", () => {
    const catalog = loadCatalog();
    const body = `| **Disponibilidad** | 99.9 % | multi-instancia |\n| **Throughput** | ≥ 200 ops/s de mensajería | outbox |`;
    const { body: out, warnings } = sanitizePaso0InventedSlosInSection2(body, catalog!);
    assert.ok(warnings.length >= 2);
    assert.doesNotMatch(out, /99\.9\s*%/i);
    assert.doesNotMatch(out, /p99/i);
  });

  it("detectPaso0Section6PlaceholderBlocker detecta §6 incompleto", () => {
    const catalog = loadCatalog();
    const mdd = `## 6. Seguridad\n_(Completar desde catálogo Paso 0 / nodo Seguridad.)_\n`;
    const blockers = detectPaso0Section6PlaceholderBlocker(mdd, catalog!);
    assert.equal(blockers.length, 1);
    assert.match(blockers[0]!, /§6 incompleto/i);
  });

  it("enforcePaso0CatalogOnMdd hidrata §6 y corrige §1 MVP en borrador débil", () => {
    const catalog = loadCatalog();
    const weak = `
## 1. Contexto
- Implementación de E2EE posterior al MVP.

## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY, context_id UUID REFERENCES contexts(id) ON DELETE CASCADE);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |

## 6. Seguridad
_(Completar desde catálogo Paso 0 / nodo Seguridad.)_
`;
    const result = enforcePaso0CatalogOnMdd(weak, catalog!);
    assert.match(result.markdown, /E2EE configurable.*MVP/i);
    assert.match(result.markdown, /\| Regla \| D-ID \|/);
    const section3 = result.markdown.match(/## 3\. Modelo de Datos[\s\S]*?(?=\n## 4\.)/)?.[0] ?? "";
    assert.match(section3, /CREATE TABLE messages[\s\S]*?ON DELETE RESTRICT/i);
    assert.doesNotMatch(section3, /ON DELETE CASCADE/i);
    const blockers = collectPaso0DeliveryGateBlockers(result.markdown, catalog!);
    assert.ok(!blockers.some((b) => /§6 incompleto/i.test(b)));
  });

  it("paso0CanonicalCreateTableStub applications sin FK self-referencial application_id", () => {
    const catalog = loadCatalog();
    const stub = paso0CanonicalCreateTableStub("applications", catalog);
    assert.ok(stub);
    assert.match(stub!, /CREATE TABLE applications/i);
    assert.doesNotMatch(stub!, /application_id UUID NOT NULL REFERENCES applications/i);
    assert.match(stub!, /functional_owner_id UUID NOT NULL REFERENCES identities/i);
    assert.match(stub!, /retention_policy_id UUID NOT NULL REFERENCES retention_policies/i);
  });

  it("sanitizePaso0ErDiagramContent elimina users, approved_by duplicado y self-ref applications", () => {
    const catalog = loadCatalog();
    const raw = `erDiagram
  users {
    uuid id PK
    string email
  }
  applications {
    uuid id PK
    uuid approved_by FK
    uuid approved_by FK
  }
  applications ||--o{ applications : parent
  users ||--o{ applications : owns
  applications ||--o{ contexts : has`;
    const out = sanitizePaso0ErDiagramContent(raw, catalog);
    assert.doesNotMatch(out, /\busers\b/i);
    assert.doesNotMatch(out, /applications \|\|--o\{\s+applications/i);
    assert.equal((out.match(/\bapproved_by\b/gi) ?? []).length, 1);
    assert.match(out, /applications \|\|--o\{\s+contexts/i);
  });

  it("replaceSection3SqlWithPaso0CanonicalStubs + ER regen elimina users y self-ref applications", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (
  id UUID PRIMARY KEY,
  approved_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  is default BOOLEAN
);
\`\`\`

\`\`\`mermaid
erDiagram
  users ||--o{ applications : owns
  applications ||--o{ applications : parent
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
`;
    const replaced = replaceSection3SqlWithPaso0CanonicalStubs(mdd, catalog);
    const er = regenerateAndSanitizePaso0Section3ErDiagram(replaced, catalog);
    assert.ok(er.applied);
    const appsBlock = er.markdown.match(/CREATE TABLE applications\s*\([\s\S]*?\);/)?.[0] ?? "";
    assert.doesNotMatch(appsBlock, /\bapplication_id\b/i);
    assert.doesNotMatch(er.markdown, /\busers\b/i);
    assert.doesNotMatch(er.markdown, /applications \|\|--o\{\s+applications/i);
    assert.match(er.markdown, /CREATE TABLE applications[\s\S]*functional_owner_id UUID NOT NULL REFERENCES identities/i);
  });

  it("enforcePaso0CatalogOnMdd sanea §7 manifest SSO (D-003): sin JWT_PRIVATE_KEY ni hashing_rounds", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |

## 7. Infraestructura
JWT_PRIVATE_KEY, JWT_SECRET para login local con contraseña y MFA TOTP.

\`\`\`json
{
  "security": {
    "authentication": "login/password local",
    "hashing_algorithm": "bcrypt",
    "hashing_rounds": 12,
    "mfa_strategy": "TOTP"
  }
}
\`\`\`
`;
    const result = enforcePaso0CatalogOnMdd(mdd, catalog);
    assert.doesNotMatch(result.markdown, /JWT_PRIVATE_KEY/i);
    assert.doesNotMatch(result.markdown, /JWT_SECRET/i);
    assert.doesNotMatch(result.markdown, /hashing_rounds/i);
    assert.doesNotMatch(result.markdown, /login\s+local|contraseña|MFA\s+TOTP/i);
    assert.doesNotMatch(result.markdown, /"mfa_strategy"\s*:\s*"TOTP"/i);
  });

  it("regenerateAndSanitizePaso0Section3ErDiagram no incluye entidad users", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE identities (id UUID PRIMARY KEY);
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE contexts (id UUID PRIMARY KEY, application_id UUID REFERENCES applications(id));
\`\`\`

\`\`\`mermaid
erDiagram
  users ||--o{ applications : owns
\`\`\`
`;
    const { markdown, applied } = regenerateAndSanitizePaso0Section3ErDiagram(mdd, catalog);
    assert.ok(applied);
    assert.doesNotMatch(markdown, /\busers\b/i);
    assert.match(markdown, /\bidentities\b/i);
  });

  it("shouldReplaceSection3WithPaso0Canonical detecta híbrido corrupto + stubs duplicados", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY, is default BOOLEAN);
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`

\`\`\`sql
-- Paso 0 canonical stubs (deterministic)
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE identities (id UUID PRIMARY KEY);
\`\`\`
`;
    assert.ok(shouldReplaceSection3WithPaso0Canonical(mdd, catalog));
    assert.ok(detectSection3DuplicateCreateTableNames(extractSectionByNumber(mdd, 3) ?? "").includes("applications"));
  });

  it("repairAndInjectPaso0Section3ForGate: híbrido LLM+corrupt+stubs → un solo bloque canónico", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
Resumen del modelo.

\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY, is default BOOLEAN);
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY, content text TEXT NOT NULL);
\`\`\`

\`\`\`sql
-- Paso 0 canonical stubs (append)
CREATE TABLE applications (id UUID PRIMARY KEY);
CREATE TABLE business_events (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
`;
    const repaired = repairAndInjectPaso0Section3ForGate(mdd, catalog);
    assert.ok(repaired.applied.some((a) => a.includes("§3-canonical-replace")));
    const section3 = extractSectionByNumber(repaired.markdown, 3) ?? "";
    const sqlBlocks = [...section3.matchAll(/```sql\s*\n([\s\S]*?)```/gi)];
    assert.equal(sqlBlocks.length, 1, "debe quedar un único fence sql");
    assert.doesNotMatch(section3, /\bis default\b/i);
    assert.doesNotMatch(section3, /content text TEXT/i);
    assert.doesNotMatch(section3, /-- Paso 0 canonical stubs \(append\)/i);
    assert.equal(detectPaso0Section3SqlSyntaxErrors(section3).length, 0);
    assert.equal(detectSection3DuplicateCreateTableNames(section3).length, 0);
  });

  it("enforcePaso0CatalogOnMdd: §7.1 password+TOTP y manifest SSO saneados (D-003)", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |

## 7. Infraestructura
### 7.1 Autenticación y MFA
Login con contraseña y verificación TOTP para administradores.

JWT_PRIVATE_KEY y JWT_SECRET en el despliegue.

\`\`\`json
{
  "security": {
    "authentication": "login/password local",
    "hashing_algorithm": "bcrypt",
    "hashing_rounds": 12,
    "mfa_strategy": "TOTP"
  }
}
\`\`\`
`;
    const result = enforcePaso0CatalogOnMdd(mdd, catalog);
    assert.doesNotMatch(result.markdown, /login\/password/i);
    assert.doesNotMatch(result.markdown, /JWT_PRIVATE_KEY/i);
    assert.doesNotMatch(result.markdown, /hashing_rounds"\s*:\s*12/i);
    assert.doesNotMatch(result.markdown, /"mfa_strategy"\s*:\s*"TOTP"/i);
    assert.doesNotMatch(result.markdown, /Login con contraseña/i);
    assert.match(result.markdown, /SSO OIDC \(D-003/i);
  });

  it("dedupeSection3ToSingleCanonicalFence colapsa múltiples fences duplicados", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY, application_id UUID);
CREATE TABLE topics (id UUID PRIMARY KEY);
\`\`\`
`;
    const out = dedupeSection3ToSingleCanonicalFence(mdd, catalog);
    const section3 = extractSectionByNumber(out, 3) ?? "";
    assert.equal([...section3.matchAll(/```sql/gi)].length, 1);
    assert.equal(detectSection3DuplicateCreateTableNames(section3).length, 0);
  });

  it("normalizePaso0Section3Layout reordena sql → erDiagram → TechnicalMetadata", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
Resumen del modelo.

\`\`\`mermaid
erDiagram
  contexts {
    uuid id PK
  }
\`\`\`

\`\`\`sql
[high_security]
\`\`\`

\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
CREATE TABLE messages (id UUID PRIMARY KEY);
\`\`\`

\`\`\`TechnicalMetadata
[external_api]
\`\`\`
`;
    const { markdown, applied } = normalizePaso0Section3Layout(mdd, catalog);
    assert.ok(applied);
    const section3 = extractSectionByNumber(markdown, 3) ?? "";
    const sqlIdx = section3.search(/```sql/i);
    const erIdx = section3.search(/```mermaid/i);
    const metaIdx = section3.search(/```TechnicalMetadata/i);
    assert.ok(sqlIdx >= 0 && erIdx > sqlIdx, "sql debe preceder erDiagram");
    assert.ok(metaIdx > erIdx, "TechnicalMetadata debe ir tras erDiagram");
    assert.equal([...section3.matchAll(/```sql/gi)].length, 1);
    assert.doesNotMatch(section3, /```sql\s*\n\[high_security\]/i);
    assert.match(section3, /```TechnicalMetadata[\s\S]*\[high_security\]/i);
  });

  it("replaceSection3SqlWithPaso0CanonicalStubs deja sql antes de erDiagram tras replace", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
Notas del modelo.

\`\`\`mermaid
erDiagram
  applications ||--o{ contexts : has
\`\`\`

\`\`\`sql
CREATE TABLE applications (id UUID PRIMARY KEY, is default BOOLEAN);
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`

## 4. Contratos de API
| POST | \`/ingest/events\` | ingest |
`;
    const out = replaceSection3SqlWithPaso0CanonicalStubs(mdd, catalog);
    const section3 = extractSectionByNumber(out, 3) ?? "";
    const sqlIdx = section3.search(/```sql/i);
    const erIdx = section3.search(/```mermaid/i);
    assert.ok(sqlIdx >= 0);
    if (erIdx >= 0) assert.ok(erIdx > sqlIdx, "sql debe preceder erDiagram tras replace");
    assert.equal([...section3.matchAll(/```sql/gi)].length, 1);
    assert.equal(detectPaso0Section3SqlSyntaxErrors(section3).length, 0);
  });

  it("normalizePaso0Section3Layout cierra fences huérfanos", () => {
    const catalog = loadCatalog();
    const mdd = `
## 3. Modelo de Datos
\`\`\`sql
CREATE TABLE contexts (id UUID PRIMARY KEY);
\`\`\`

\`\`\`mermaid
erDiagram
  contexts {
    uuid id PK
  }
`;
    const { markdown } = normalizePaso0Section3Layout(mdd, catalog);
    const fenceCount = (markdown.match(/```/g) ?? []).length;
    assert.equal(fenceCount % 2, 0, "paridad de fences");
    assert.match(markdown, /```sql[\s\S]*CREATE TABLE contexts/i);
  });

  it("deselectStranglerFigInGovernanceWizard deselecciona línea exacta del wizard", () => {
    const catalog = loadCatalog();
    const govBody = MDD_GOVERNANCE_WIZARD_BODY.replace(
      /^- \[ \] \*\*Strangler Fig \(Estrangulamiento\):\*\*/m,
      "- [X] **Strangler Fig (Estrangulamiento):**",
    );
    let mdd = ensureMddGovernanceSection("# MDD\n\n## 1. Contexto\n", govBody);
    assert.match(mdd, /- \[X\] \*\*Strangler Fig \(Estrangulamiento\):\*\*/);
    const { markdown, warnings } = deselectStranglerFigInGovernanceWizard(mdd, catalog);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(markdown, /- \[X\] \*\*Strangler Fig \(Estrangulamiento\):\*\*/);
    assert.match(markdown, /- \[ \] \*\*Strangler Fig \(Estrangulamiento\):\*\*/);
  });
});
