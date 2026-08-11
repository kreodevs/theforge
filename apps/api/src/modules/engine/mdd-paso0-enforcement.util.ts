/**
 * Post-gen enforcement MDD cuando hay catálogo Paso 0 definitivo pegado (D-ID).
 * Complementa guardrails de prompts: elimina tablas prohibidas/inventadas en §3,
 * sanea §1/§4 y reporta gaps de entidades canónicas ausentes.
 */

import {
  AUTH_ENTITY_FAMILY,
  apiPathMatchesPaso0ForbiddenSegment,
  catalogMarksStranglerOutOfScope,
  catalogRequiresMobileOnlineOnly,
  catalogRequiresSsoIntegral,
  catalogToSuggestedEntitySlugs,
  enrichPaso0DecisionCatalog,
  isPaso0ForbiddenEntityTable,
  isWorkspaceChatPaso0Catalog,
  listPaso0MandatoryEntities,
  listPaso0MandatoryRouteFamilies,
  PASO0_CANONICAL_RETENTION_MARKERS,
  PASO0_FORBIDDEN_ENTITY_TABLES,
  PASO0_INVENTED_PLATFORM_TABLES,
  PASO0_OFFLINE_FIRST_PATTERNS,
  PASO0_SSO_ALLOWED_AUTH_ROUTE_SEGMENTS,
  WORKSPACE_CHAT_EDGE_CASES,
  WORKSPACE_CHAT_GLOSSARY_TERMS,
  WORKSPACE_CHAT_RETENTION_GLOSSARY_TEXT,
  catalogRequiresStackAsProposal,
  listPaso0ForbiddenApiRouteSegmentsForCatalog,
  scorePaso0ExpectedAlignment,
  type Paso0ApiRouteFamily,
  type Paso0DecisionCatalog,
} from "@theforge/shared-types";
import { stripClarifierAgentBriefFromSection1 } from "../ai-analysis/utils/mdd-clarifier-draft.util.js";
import {
  repairGluedEmptyJsonArrays,
  repairContratosMarkdownArtifacts,
  sanitizeSection4JsonBlocksForDelivery,
  stripContractStubJsonBlocks,
} from "../ai-analysis/utils/mdd-sanitize/contratos-format.js";
import { regenerateErDiagramFromSql } from "../ai-analysis/utils/mdd-diagram-suggestions.js";
import { ensureDocumentFenceParity } from "../ai-analysis/utils/mdd-sanitize/section-fence.util.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";
import { composePaso0CanonicalStubsSql, composeFullPaso0Section3CanonicalSql, paso0CanonicalCreateTableStub } from "./paso0-canonical-ddl-stubs.util.js";
import {
  applyPaso0TailSectionEnrichment,
  deduplicatePaso0TailSections,
  deselectStranglerFigInGovernanceWizard,
  detectMissingPaso0Section9Blocker,
  paso0Section6NeedsHydration,
} from "./mdd-paso0-trazabilidad.util.js";

/** Entidades prohibidas en erDiagram Paso 0 (auth local / SSO integral). */
const PASO0_FORBIDDEN_ER_ENTITIES = new Set(["users", "sessions", "refresh_tokens", "mfa_devices", "mfa_secrets"]);

/** Sanea contenido erDiagram: entidades prohibidas, attrs duplicados, self-ref applications. */
export function sanitizePaso0ErDiagramContent(
  diagramContent: string,
  catalog: Paso0DecisionCatalog,
): string {
  const content = filterErDiagramContentToCanonicalEntities(diagramContent, catalog);
  const lines = content.split("\n");
  const out: string[] = [];
  let skipEntityBlock = false;
  let inEntity = false;
  const seenAttrs = new Set<string>();

  for (const line of lines) {
    if (/^\s*applications\s+\|\|--o\{\s+applications\s*:/i.test(line)) {
      continue;
    }

    const entityOpen = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\s*$/);
    if (entityOpen) {
      const name = entityOpen[1]!.toLowerCase();
      skipEntityBlock = PASO0_FORBIDDEN_ER_ENTITIES.has(name);
      inEntity = !skipEntityBlock;
      seenAttrs.clear();
      if (!skipEntityBlock) out.push(line);
      continue;
    }

    if (/^\s*\}\s*$/.test(line)) {
      if (!skipEntityBlock) out.push(line);
      skipEntityBlock = false;
      inEntity = false;
      seenAttrs.clear();
      continue;
    }

    if (skipEntityBlock) continue;

    if (inEntity) {
      const attrMatch = line.match(/^\s*\S+\s+(\S+)/);
      if (attrMatch) {
        const key = attrMatch[1]!.toLowerCase();
        if (seenAttrs.has(key)) continue;
        seenAttrs.add(key);
      }
    }

    const relMatch = line.match(
      /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+\|\|--o\{\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+:/,
    );
    if (relMatch) {
      const left = relMatch[1]!.toLowerCase();
      const right = relMatch[2]!.toLowerCase();
      if (PASO0_FORBIDDEN_ER_ENTITIES.has(left) || PASO0_FORBIDDEN_ER_ENTITIES.has(right)) {
        continue;
      }
      if (left === "applications" && right === "applications") continue;
    }

    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Aplica saneo erDiagram en todos los bloques mermaid de §3. */
export function sanitizePaso0ErDiagramInSection3(
  section3: string,
  catalog: Paso0DecisionCatalog,
): string {
  return section3.replace(/```mermaid\n([\s\S]*?)```/gi, (block, inner: string) => {
    if (!/\berDiagram\b/i.test(inner)) return block;
    const sanitized = sanitizePaso0ErDiagramContent(inner, catalog);
    return `\`\`\`mermaid\n${sanitized}\n\`\`\``;
  });
}

/** Regenera erDiagram desde SQL §3 y aplica saneo Paso 0. */
export function regenerateAndSanitizePaso0Section3ErDiagram(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  const regen = regenerateErDiagramFromSql(mddMarkdown, { paso0Catalog: catalog });
  if (!regen) return { markdown: mddMarkdown, applied: false };
  const section3 = extractSectionByNumber(regen, 3);
  if (!section3) return { markdown: regen, applied: true };
  const sanitizedSection3 = sanitizePaso0ErDiagramInSection3(section3, catalog);
  if (sanitizedSection3 === section3) return { markdown: regen, applied: true };
  return { markdown: regen.replace(section3, sanitizedSection3), applied: true };
}

export type Paso0MddEnforcementResult = {
  markdown: string;
  strippedTables: string[];
  missingCanonical: string[];
  section1Warnings: string[];
  section2Warnings: string[];
  section4StrippedRoutes: string[];
  paso0RoutesInjected: string[];
  retentionWarnings: string[];
  localAuthWarnings: string[];
  gaps: string[];
};

function stripCreateTableFromSql(sql: string, tableName: string): string {
  const re = new RegExp(
    `(?:^|\\n)(?:--[^\\n]*\\n)*CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?${tableName}["']?\\s*\\([\\s\\S]*?\\);`,
    "gi",
  );
  return sql.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

type ParsedCreateTable = {
  name: string;
  start: number;
  end: number;
  text: string;
};

/** Captura el nombre canónico tras CREATE TABLE (soporta schema.table y backticks). */
const CREATE_TABLE_HEAD_RE =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["']?[a-zA-Z_][a-zA-Z0-9_]*["']?\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s*\(/gi;

function paso0CreateTableEntityPattern(tableName: string): string {
  return `(?:["']?[a-zA-Z_][a-zA-Z0-9_]*["']?\\.)?["']?${tableName}["']?`;
}

/** Localiza cada CREATE TABLE con paréntesis balanceados (incluye anidados corruptos). */
function parseCreateTableStatements(sql: string): ParsedCreateTable[] {
  const stmts: ParsedCreateTable[] = [];
  CREATE_TABLE_HEAD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CREATE_TABLE_HEAD_RE.exec(sql)) !== null) {
    const name = m[1]!.toLowerCase();
    const start = m.index;
    const open = start + m[0].length;
    let depth = 1;
    let i = open;
    while (i < sql.length && depth > 0) {
      const ch = sql[i]!;
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    while (i < sql.length && /\s/.test(sql[i]!)) i++;
    if (sql[i] === ";") i++;
    stmts.push({ name, start, end: i, text: sql.slice(start, i).trim() });
  }
  return stmts;
}

function closePartialCreateTable(partial: string): string {
  const lines = partial.split("\n");
  while (lines.length > 0) {
    const last = lines[lines.length - 1]!.trim();
    if (!last || last === "," || /^CREATE\s+TABLE/i.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  if (lines.length > 0) {
    const lastIdx = lines.length - 1;
    lines[lastIdx] = lines[lastIdx]!.replace(/,\s*$/, "");
  }
  return `${lines.join("\n")}\n);`;
}

/** Cierra CREATE TABLE padre truncado antes de un CREATE TABLE hijo embebido (p. ej. analytics_rollups). */
function repairNestedCreateTables(stmts: ParsedCreateTable[], sql: string): ParsedCreateTable[] {
  const sorted = [...stmts].sort((a, b) => a.start - b.start);
  const out: ParsedCreateTable[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const stmt = sorted[i]!;
    const nested = sorted.filter(
      (other, j) => j !== i && other.start > stmt.start && other.end <= stmt.end,
    );
    if (nested.length === 0) {
      out.push(stmt);
      continue;
    }
    const firstNested = nested.sort((a, b) => a.start - b.start)[0]!;
    const partial = sql.slice(stmt.start, firstNested.start).trimEnd();
    out.push({
      name: stmt.name,
      start: stmt.start,
      end: firstNested.start,
      text: closePartialCreateTable(partial),
    });
  }
  return out;
}

/** Conserva la aparición canónica de cada tabla (prefiere sin CREATE INDEX embebido / más completa). */
function dedupeCreateTableStatements(stmts: ParsedCreateTable[]): ParsedCreateTable[] {
  const byName = new Map<string, ParsedCreateTable>();
  for (const stmt of stmts.sort((a, b) => a.start - b.start)) {
    const prev = byName.get(stmt.name);
    if (!prev) {
      byName.set(stmt.name, stmt);
      continue;
    }
    const prevEmbedded = /CREATE\s+INDEX/i.test(
      prev.text.slice(prev.text.indexOf("(") + 1, prev.text.lastIndexOf(")")),
    );
    const curEmbedded = /CREATE\s+INDEX/i.test(
      stmt.text.slice(stmt.text.indexOf("(") + 1, stmt.text.lastIndexOf(")")),
    );
    if (prevEmbedded && !curEmbedded) {
      byName.set(stmt.name, stmt);
    } else if (!prevEmbedded && curEmbedded) {
      continue;
    } else if (!prevEmbedded && !curEmbedded) {
      continue;
    } else if (stmt.text.length >= prev.text.length) {
      byName.set(stmt.name, stmt);
    }
  }
  return [...byName.values()].sort((a, b) => a.start - b.start);
}

const PASO0_CRITICAL_APPROVAL_TABLES = new Set(["break_glass_requests", "export_requests"]);

function isCorruptPaso0ApprovalTable(stmt: string): boolean {
  const body = stmt ?? "";
  if ((body.match(/\bapproved_by\b/gi) ?? []).length > 1) return true;
  if (/REFERENCES\s+users\s*\(\s*id\s*\)/i.test(body)) return true;
  if (/approved_by\s+IS\s+(?:NULL\s+OR\s+)?(?:NULL\s+OR\s+)?approved_by/i.test(body)) return true;
  if (/approved_by\s+IS\s+DISTINCT\s+FROM\s+approved_by/i.test(body)) return true;
  if (/,\s*'approved',\s*'approved'/i.test(body)) return true;
  if (/^\s*y\s+checksums/im.test(body)) return true;
  return false;
}

/** Sustituye CREATE TABLE corruptos de break-glass/export por stub canónico Paso 0. */
export function replaceCorruptPaso0ApprovalTablesInSql(sql: string): string {
  let out = sql ?? "";
  for (const table of PASO0_CRITICAL_APPROVAL_TABLES) {
    const re = new RegExp(`CREATE\\s+TABLE\\s+${table}\\s*\\([\\s\\S]*?\\)\\s*;`, "gi");
    out = out.replace(re, (match) => {
      if (!isCorruptPaso0ApprovalTable(match)) return match;
      const stub = paso0CanonicalCreateTableStub(table, null);
      return stub?.trim() ?? match;
    });
  }
  return out;
}

/** Elimina columnas duplicadas y CONSTRAINT nonsense dentro de cada CREATE TABLE. */
export function dedupeColumnsWithinCreateTableSql(sql: string): string {
  return (sql ?? "").replace(
    /CREATE\s+TABLE\s+([a-zA-Z_][\w]*)\s*\(([\s\S]*?)\)\s*;/gi,
    (_match, tableName: string, body: string) => {
      const seenCols = new Set<string>();
      const outLines: string[] = [];
      for (const line of body.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("--")) {
          outLines.push(line);
          continue;
        }
        if (/^CONSTRAINT\b/i.test(trimmed)) {
          if (/chk_(?:break_glass|export)_approvers/i.test(trimmed)) continue;
          if (/approved_by\s+IS\s+(?:NULL\s+OR\s+)?(?:NULL\s+OR\s+)?approved_by/i.test(trimmed)) continue;
          outLines.push(line);
          continue;
        }
        const colMatch = trimmed.match(/^([a-z_][a-z0-9_]*)\s+/i);
        if (!colMatch) {
          outLines.push(line);
          continue;
        }
        const col = colMatch[1]!.toLowerCase();
        if (seenCols.has(col)) continue;
        seenCols.add(col);
        const fixed = line.replace(/REFERENCES\s+users\s*\(\s*id\s*\)/gi, "REFERENCES identities(id)");
        outLines.push(fixed);
      }
      return `CREATE TABLE ${tableName} (\n${outLines.join("\n")}\n);`;
    },
  );
}

function extractCreateIndexStatements(sql: string): string[] {
  const re = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+[\s\S]*?\)\s*;/gi;
  return (sql.match(re) ?? []).map((s) => s.trim());
}

function dedupeCreateIndexStatements(indexes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const idx of indexes) {
    const key = idx.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(idx);
  }
  return out;
}

/** Elimina índice inválido idempotency_key cuando business_events usa uq_event_dedup (D-080). */
function isInvalidBusinessEventsIdempotencyIndex(indexSql: string): boolean {
  return /idx_business_events_idempotency|idempotency_key/i.test(indexSql ?? "");
}

/** idx_business_events_context sin columna context_id (business_events usa application_id, D-080). */
function isInvalidBusinessEventsContextIndex(indexSql: string): boolean {
  const text = indexSql ?? "";
  if (!/idx_business_events_context/i.test(text)) return false;
  if (/\(\s*context_id\s*\)/i.test(text)) return false;
  return /idx_business_events_context|business_events\s*\([^)]*\)/i.test(text);
}

function repairInvalidBusinessEventsContextIndex(sql: string): string {
  let out = sql ?? "";
  out = out.replace(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+idx_business_events_context\s+ON\s+business_events\s*\([^)]*\)\s*;?/gi,
    "CREATE INDEX idx_business_events_application ON business_events (application_id);\n",
  );
  out = out.replace(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+idx_business_events_context\s+ON\s*\([^)]*\)\s*;?/gi,
    "CREATE INDEX idx_business_events_application ON business_events (application_id);\n",
  );
  return out;
}

function filterValidCreateIndexes(indexes: string[]): string[] {
  return indexes.filter(
    (idx) => !isInvalidBusinessEventsIdempotencyIndex(idx) && !isInvalidBusinessEventsContextIndex(idx),
  );
}

function repairInvalidBusinessEventsIndexes(sql: string): string {
  let out = sql ?? "";
  out = out.replace(
    /CREATE\s+INDEX\s+idx_business_events_idempotency\s+ON\s+business_events\s*\([^)]*idempotency_key[^)]*\)\s*;?/gi,
    "-- idx_business_events_idempotency removed: dedup via uq_event_dedup (source_application, event_id)\n",
  );
  out = out.replace(
    /CREATE\s+INDEX\s+idx_business_events_idempotency\s+ON\s*\([^)]*idempotency_key[^)]*\)\s*;?/gi,
    "-- idx_business_events_idempotency removed: dedup via uq_event_dedup (source_application, event_id)\n",
  );
  out = out.replace(
    /CREATE\s+UNIQUE\s+INDEX\s+[^;\n]*idempotency_key[^;\n]*ON\s+business_events[^;]*;?/gi,
    "-- invalid business_events idempotency index removed (use uq_event_dedup)\n",
  );
  return out;
}

/** Repara UNIQUE/constraints en analytics_rollups que referencian columnas ausentes. */
function repairAnalyticsRollupsConstraintColumns(sql: string): string {
  const re = /CREATE TABLE analytics_rollups\s*\([\s\S]*?\);/gi;
  return (sql ?? "").replace(re, (block) => {
    if (!/\bperiod_start\b/i.test(block)) return block;
    if (/\bperiod_start\s+(?:UUID|VARCHAR|TEXT|TIMESTAMPTZ|DATE|INTEGER|BIGINT|BOOLEAN)/i.test(block)) {
      return block;
    }
    return block.replace(/\bperiod_start\b/gi, "bucket_start");
  });
}

/** Repara columnas corruptas en purge_tombstones (LLM mezcla purged_by con ruido de identidad). */
function repairCorruptPurgeTombstonesColumns(sql: string): string {
  return (sql ?? "").replace(
    /\n\s*purged_by[^\n]*(?:o UUID de identity|reason TEXT)[^\n]*/gi,
    "\n",
  );
}

/** Repara typos SQL frecuentes del LLM (Paso 0 Workspace Chat). */
export function repairSection3SqlSyntax(sql: string): string {
  let out = sql ?? "";
  if (!out.trim()) return out;

  const createIndexStmtRe = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+[\s\S]*?\)\s*;/gi;

  out = out.replace(/\bis default\b/gi, "is_default");
  out = out.replace(/\bdefault\s+BOOLEAN\b/gi, "is_default BOOLEAN");
  out = out.replace(/\bobjetos_checksum\b/gi, "checksum");
  out = out.replace(/\bcontent text TEXT\b/gi, "content_text TEXT");
  out = out.replace(/\bcontent text\b/gi, "content_text");
  out = out.replace(/\bquery text TEXT\b/gi, "query_text TEXT");
  out = out.replace(/\bquery text\b/gi, "query_text");
  out = out.replace(/\bno\s+texto\s+plano\s+scope\b/gi, "allowed_origins");
  out = out.replace(
    /\bscope\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'no\s+texto\s+plano'/gi,
    "allowed_origins TEXT[] NOT NULL DEFAULT '{}'",
  );
  out = out.replace(/\btotp_secret\b[^\n,)]*/gi, "-- totp_secret removed (D-003 SSO Integral)");
  out = out.replace(/\bmfa_enabled\b[^\n,)]*/gi, "-- mfa_enabled removed (D-003 SSO Integral)");
  out = out.replace(/CREATE\s+TABLE\s+mfa_secrets\s*\([\s\S]*?\);/gi, "-- mfa_secrets removed (D-003 SSO Integral)\n");
  out = out.replace(/\bMinIO_checksum_sha256\b/gi, "checksum_sha256");
  out = out.replace(/\bminio_checksum_sha256\b/gi, "checksum_sha256");
  out = out.replace(/\bS3_checksum_sha256\b/gi, "checksum_sha256");
  out = out.replace(/^\s*y\s+checksums[^\n]*$/gim, "");
  out = out.replace(
    /CREATE\s+INDEX\s+idx_audit_identity\s+ON\s+audit_entries\s*\(\s*identity_id\s*\)/gi,
    "CREATE INDEX idx_audit_identity ON audit_entries (actor_id)",
  );
  out = out.replace(
    /idx_audit_identity\s+ON\s+audit_entries\s*\(\s*identity_id\s*\)/gi,
    "idx_audit_identity ON audit_entries (actor_id)",
  );
  out = repairCorruptPurgeTombstonesColumns(out);
  out = repairAnalyticsRollupsConstraintColumns(out);
  out = repairInvalidBusinessEventsIndexes(out);
  out = repairInvalidBusinessEventsContextIndex(out);

  if (/ON DELETE CASCADE/i.test(out)) {
    out = out.replace(/ON DELETE CASCADE/gi, "ON DELETE RESTRICT");
  }

  const extractedIndexes: string[] = [];
  out = out.replace(createIndexStmtRe, (full, offset) => {
    const before = out.slice(0, offset);
    const lastCreate = before.lastIndexOf("CREATE TABLE");
    if (lastCreate === -1) return full;
    const segment = before.slice(lastCreate);
    const openCount = (segment.match(/\(/g) ?? []).length;
    const closeCount = (segment.match(/\)/g) ?? []).length;
    if (openCount > closeCount) {
      extractedIndexes.push(full.trim());
      return "\n";
    }
    return full;
  });

  const indexes = filterValidCreateIndexes(
    dedupeCreateIndexStatements([
      ...extractCreateIndexStatements(out),
      ...extractedIndexes,
    ]),
  );
  const withoutDupIndexes = out.replace(createIndexStmtRe, "\n").replace(/\n{3,}/g, "\n\n");
  if (indexes.length === 0) return repairInvalidBusinessEventsIndexes(withoutDupIndexes.trimEnd());
  return repairInvalidBusinessEventsIndexes(
    `${withoutDupIndexes.trimEnd()}\n\n${indexes.join("\n\n")}`.trimEnd(),
  );
}

/**
 * Repara SQL §3 corrupto: CREATE TABLE anidado dentro de otro y duplicados del mismo nombre.
 * Idempotente; no altera tablas sin duplicados ni anidamiento.
 */
export function sanitizeSection3SqlStructure(sql: string): string {
  const raw = repairSection3SqlSyntax(sql ?? "");
  if (!raw.trim()) return raw;
  const afterCorrupt = replaceCorruptPaso0ApprovalTablesInSql(raw);
  const stmts = parseCreateTableStatements(afterCorrupt);
  if (stmts.length === 0) return afterCorrupt;
  const repaired = repairNestedCreateTables(stmts, afterCorrupt);
  const deduped = dedupeCreateTableStatements(repaired);
  const indexes = filterValidCreateIndexes(
    dedupeCreateIndexStatements(extractCreateIndexStatements(afterCorrupt)),
  );
  const tableSql = deduped.map((s) => dedupeColumnsWithinCreateTableSql(s.text)).join("\n\n");
  const combined = [tableSql, ...indexes].filter(Boolean).join("\n\n");
  const leadingComments = raw.match(/^((?:--[^\n]*\n)+)/)?.[1]?.trimEnd();
  if (leadingComments && !combined.startsWith("--")) {
    return `${leadingComments}\n\n${combined}`;
  }
  return combined;
}

/** Repara sintaxis/estructura SQL en todos los bloques ```sql de §3. */
export function repairAllSection3SqlFences(section3: string): string {
  if (!/```sql\n/i.test(section3 ?? "")) return section3;
  return section3.replace(/```sql\n([\s\S]*?)```/gi, (_block, inner: string) => {
    const sanitized = sanitizeSection3SqlStructure(inner ?? "");
    return `\`\`\`sql\n${sanitized.trimEnd()}\n\`\`\``;
  });
}

/** Repara §3 SQL en el MDD completo (idempotente). */
export function repairSection3SqlInMdd(mddMarkdown: string): string {
  const section3 = extractSectionByNumber(mddMarkdown, 3);
  if (!section3) return mddMarkdown;
  const repaired = repairAllSection3SqlFences(section3);
  if (repaired === section3) return mddMarkdown;
  return mddMarkdown.replace(section3, repaired);
}

const PASO0_SECTION3_TECH_METADATA_TAG_RE =
  /\[(?:high_security|external_api|multi_tenant|cicd_pipeline|real_time)\]/i;

/** Reordena §3: prosa → ```sql``` → ```mermaid erDiagram``` → ```TechnicalMetadata```. */
export function normalizePaso0Section3Layout(
  mddMarkdown: string,
  _catalog?: Paso0DecisionCatalog,
): { markdown: string; applied: boolean } {
  const section3 = extractSectionByNumber(mddMarkdown, 3);
  if (!section3) return { markdown: mddMarkdown, applied: false };

  const heading = section3.match(/^##[^\n]+/)?.[0] ?? "## 3. Modelo de Datos";
  let scratch = section3.replace(/^##[^\n]+\n?/, "");

  const sqlParts: string[] = [];
  const erBlocks: string[] = [];
  const metaBlocks: string[] = [];

  scratch = scratch.replace(/```sql\s*\n([\s\S]*?)```/gi, (_block, inner: string) => {
    const trimmed = (inner ?? "").trim();
    if (!trimmed) return "";
    if (!/CREATE\s+TABLE/i.test(trimmed) && PASO0_SECTION3_TECH_METADATA_TAG_RE.test(trimmed)) {
      metaBlocks.push(trimmed);
      return "";
    }
    if (/CREATE\s+TABLE/i.test(trimmed)) {
      sqlParts.push(trimmed);
    }
    return "";
  });

  scratch = scratch.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_block, inner: string) => {
    if (/\berDiagram\b/i.test(inner ?? "")) {
      erBlocks.push((inner ?? "").trim());
    }
    return "";
  });

  scratch = scratch.replace(
    /```(?:TechnicalMetadata|technicalmetadata)\s*\n([\s\S]*?)```/gi,
    (_block, inner: string) => {
      const trimmed = (inner ?? "").trim();
      if (trimmed) metaBlocks.push(trimmed);
      return "";
    },
  );

  scratch = scratch
    .replace(/```\s*\n?\s*```/g, "")
    .replace(/^\s*```(?:sql|mermaid|TechnicalMetadata)?\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let mergedSql = sqlParts.join("\n\n").trim();
  if (mergedSql) mergedSql = sanitizeSection3SqlStructure(mergedSql);

  const erContent = erBlocks.length > 0 ? erBlocks[erBlocks.length - 1]! : "";
  const metaContent = [...new Set(metaBlocks.map((m) => m.trim()).filter(Boolean))].join("\n");

  const parts: string[] = [];
  if (scratch) parts.push(scratch);
  if (mergedSql) parts.push(`\`\`\`sql\n${mergedSql.trimEnd()}\n\`\`\``);
  if (erContent) parts.push(`\`\`\`mermaid\n${erContent}\n\`\`\``);
  if (metaContent) parts.push(`\`\`\`TechnicalMetadata\n${metaContent}\n\`\`\``);

  const rebuiltBody = parts.join("\n\n").trim();
  const newSection3 = rebuiltBody ? `${heading}\n\n${rebuiltBody}\n` : `${heading}\n`;
  const replaced = mddMarkdown.replace(section3, newSection3);
  const markdown = ensureDocumentFenceParity(replaced);
  return { markdown, applied: markdown !== mddMarkdown };
}

function paso0Section3AfterErRegen(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string {
  return normalizePaso0Section3Layout(mddMarkdown, catalog).markdown;
}

/**
 * Sustituye todos los bloques ```sql de §3 por DDL canónico Paso 0 (orden FK).
 * Preserva prosa, erDiagram y TechnicalMetadata del LLM.
 */
export function replaceSection3SqlWithPaso0CanonicalStubs(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string {
  const section3 = extractSectionByNumber(mddMarkdown, 3);
  if (!section3) return mddMarkdown;
  const canonicalSql = composeFullPaso0Section3CanonicalSql(catalog);
  if (!canonicalSql.trim()) return mddMarkdown;
  const withoutSql = section3.replace(/```sql[\s\S]*?```/gi, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  const newSection3 = `${withoutSql}\n\n\`\`\`sql\n-- Paso 0 canonical §3 (deterministic replace)\n${canonicalSql.trimEnd()}\n\`\`\`\n`;
  const replaced = mddMarkdown.replace(section3, newSection3);
  return normalizePaso0Section3Layout(replaced, catalog).markdown;
}

/** Inyecta stubs DDL canónicos Paso 0 ausentes en §3 (sin inventario de dominio). */
export function injectMissingPaso0CanonicalStubsIntoMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; injected: string[] } {
  const draft = (mddMarkdown ?? "").trim();
  if (!draft) return { markdown: draft, injected: [] };

  let working = repairSection3SqlInMdd(draft);
  const missing = collectMissingPaso0CanonicalTables(working, catalog);
  if (missing.length === 0) return { markdown: working, injected: [] };

  const stubs = composePaso0CanonicalStubsSql(missing, catalog);
  if (!stubs.trim()) return { markdown: working, injected: [] };

  const section3 = extractSectionByNumber(working, 3);
  if (!section3) {
    const appendix =
      `\n\n## 3. Modelo de Datos\n\n\`\`\`sql\n${stubs}\n\`\`\`\n\n` +
      "```TechnicalMetadata\n[paso0_canonical_stubs]\n```\n";
    return { markdown: working + appendix, injected: missing };
  }

  const sqlFence = /```sql\s*\n([\s\S]*?)```/gi;
  const sqlMatches = [...section3.matchAll(sqlFence)];
  if (sqlMatches.length > 0) {
    const target = sqlMatches[sqlMatches.length - 1]!;
    const existingSql = target[1] ?? "";
    const mergedSql = `${existingSql.trimEnd()}\n\n-- Paso 0 canonical stubs (deterministic)\n${stubs}\n`;
    const sanitized = sanitizeSection3SqlStructure(mergedSql);
    const replacement = `\`\`\`sql\n${sanitized.trimEnd()}\n\`\`\``;
    const newSection3 =
      section3.slice(0, target.index!) +
      replacement +
      section3.slice(target.index! + target[0]!.length);
    working = working.replace(section3, newSection3);
    const stillMissing = collectMissingPaso0CanonicalTables(working, catalog).filter((t) =>
      missing.includes(t),
    );
    if (stillMissing.length > 0) {
      const retryStubs = composePaso0CanonicalStubsSql(stillMissing, catalog);
      if (retryStubs.trim()) {
        const updatedSection3 = extractSectionByNumber(working, 3) || newSection3;
        const appendix =
          `\n\n\`\`\`sql\n-- Paso 0 canonical stubs (append)\n${retryStubs.trimEnd()}\n\`\`\`\n`;
        working = working.replace(updatedSection3, updatedSection3.trimEnd() + appendix);
      }
    }
    return { markdown: repairSection3SqlInMdd(working), injected: missing };
  }

  const injection = `\n\n\`\`\`sql\n${stubs}\n\`\`\`\n`;
  const newSection3 = section3.trimEnd() + injection;
  working = working.replace(section3, newSection3);
  return { markdown: repairSection3SqlInMdd(working), injected: missing };
}

/**
 * Reparación §3 determinista antes del delivery gate: sanea SQL corrupto e inyecta stubs canónicos.
 * No aplica enforcement §1/§4 — usar `enforcePaso0CatalogOnMdd` después si hace falta.
 */
export function repairAndInjectPaso0Section3ForGate(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; applied: string[] } {
  const applied: string[] = [];
  let markdown = mddMarkdown ?? "";

  if (shouldReplaceSection3WithPaso0Canonical(markdown, catalog)) {
    markdown = replaceSection3SqlWithPaso0CanonicalStubs(markdown, catalog);
    applied.push("§3-canonical-replace");
    markdown = repairSection3SqlInMdd(markdown);
    applied.push("§3-sql-repair");
    const erRegen = regenerateAndSanitizePaso0Section3ErDiagram(markdown, catalog);
    if (erRegen.applied) {
      markdown = erRegen.markdown;
      applied.push("§3-er-regen");
    }
    markdown = paso0Section3AfterErRegen(markdown, catalog);
    return { markdown, applied };
  }

  markdown = repairSection3SqlInMdd(markdown);
  if (markdown !== (mddMarkdown ?? "")) applied.push("§3-sql-repair");

  const stubs = injectMissingPaso0CanonicalStubsIntoMdd(markdown, catalog);
  if (stubs.injected.length > 0) {
    markdown = stubs.markdown;
    applied.push(`§3-stubs:${stubs.injected.join(",")}`);
  }

  let stillMissing = collectMissingPaso0CanonicalTables(markdown, catalog);
  if (stillMissing.length > 0) {
    const retry = injectMissingPaso0CanonicalStubsIntoMdd(markdown, catalog);
    if (retry.injected.length > 0) {
      markdown = retry.markdown;
      applied.push(`§3-stubs-retry:${retry.injected.join(",")}`);
    }
    stillMissing = collectMissingPaso0CanonicalTables(markdown, catalog);
  }

  if (stillMissing.length > 0) {
    markdown = appendPaso0CanonicalStubsFenceToSection3(markdown, stillMissing, catalog);
    markdown = repairSection3SqlInMdd(markdown);
    applied.push(`§3-stubs-force:${stillMissing.join(",")}`);
  }

  const section3Body = extractSectionByNumber(markdown, 3) ?? "";
  if (shouldReplaceSection3WithPaso0Canonical(markdown, catalog)) {
    markdown = replaceSection3SqlWithPaso0CanonicalStubs(markdown, catalog);
    markdown = repairSection3SqlInMdd(markdown);
    applied.push("§3-canonical-replace-late");
    const erRegen = regenerateAndSanitizePaso0Section3ErDiagram(markdown, catalog);
    if (erRegen.applied) {
      markdown = erRegen.markdown;
      applied.push("§3-er-regen");
    }
    markdown = paso0Section3AfterErRegen(markdown, catalog);
  } else if (detectPaso0Section3SqlSyntaxErrors(section3Body).length > 0) {
    markdown = replaceSection3SqlWithPaso0CanonicalStubs(markdown, catalog);
    markdown = repairSection3SqlInMdd(markdown);
    applied.push("§3-canonical-replace");
    const erRegen = regenerateAndSanitizePaso0Section3ErDiagram(markdown, catalog);
    if (erRegen.applied) {
      markdown = erRegen.markdown;
      applied.push("§3-er-regen");
    }
    markdown = paso0Section3AfterErRegen(markdown, catalog);
  }

  return { markdown, applied };
}

const RECOVERABLE_PASO0_SECTION3_BLOCKER_RES: readonly RegExp[] = [
  /SQL con error de sintaxis|CREATE INDEX embebido|CREATE INDEX duplicados/i,
  /Entidad canónica obligatoria ausente/i,
  /SQL corrupto: CREATE TABLE anidado/i,
  /SQL corrupto: CREATE TABLE `security_events` duplicada/i,
  /JSON corrupto|```json inválido/i,
  /Strangler Fig documentado/i,
  /secciones duplicadas|repite headings canónicos/i,
];

/** Blockers §3 Paso 0 reparables sin LLM (stubs + saneo SQL). */
export function isRecoverablePaso0Section3GateBlocker(blocker: string): boolean {
  const text = (blocker ?? "").trim();
  if (!text) return false;
  return RECOVERABLE_PASO0_SECTION3_BLOCKER_RES.some((re) => re.test(text));
}

export function areOnlyRecoverablePaso0Section3GateBlockers(blockers: string[]): boolean {
  const items = blockers.filter((b) => b.trim().length > 0);
  if (items.length === 0) return false;
  return items.every((b) => isRecoverablePaso0Section3GateBlocker(b));
}

/** Blockers reparables en persist autofix (§3 Paso 0 + headings duplicados). */
export function areRecoverablePersistGateAutofixBlockers(blockers: string[]): boolean {
  return areOnlyRecoverablePaso0Section3GateBlockers(blockers);
}

/** Procesa todos los bloques ```sql en §3 (no solo el primero). */
function stripAllSection3SqlFences(
  section3: string,
  tablesToStrip: Iterable<string>,
): { section3: string; stripped: string[] } {
  const stripped: string[] = [];
  const newSection3 = section3.replace(/```sql\n([\s\S]*?)```/gi, (_block, inner: string) => {
    const { sql, stripped: blockStripped } = stripPaso0TablesFromSection3Sql(inner, tablesToStrip);
    stripped.push(...blockStripped);
    const sanitized = sanitizeSection3SqlStructure(sql);
    return `\`\`\`sql\n${sanitized.trimEnd()}\n\`\`\``;
  });
  return { section3: newSection3, stripped };
}

/** Tablas a eliminar de §3: prohibidas + plataforma inventada no respaldada por catálogo. */
export function listPaso0TablesToStripFromSection3(catalog: Paso0DecisionCatalog): string[] {
  const allowed = new Set(catalogToSuggestedEntitySlugs(catalog));
  for (const auth of AUTH_ENTITY_FAMILY) allowed.add(auth);

  const strip = new Set<string>();
  for (const table of PASO0_FORBIDDEN_ENTITY_TABLES) strip.add(table);
  for (const table of PASO0_INVENTED_PLATFORM_TABLES) {
    if (!allowed.has(table)) strip.add(table);
  }
  if (catalogRequiresSsoIntegral(catalog)) {
    strip.add("refresh_tokens");
    strip.add("security_events");
  }
  return [...strip].sort();
}

/** Entidades permitidas en erDiagram cuando hay catálogo Paso 0 (canónicas + auth). */
export function listPaso0AllowedErEntityNames(catalog: Paso0DecisionCatalog): Set<string> {
  const allowed = new Set(catalogToSuggestedEntitySlugs(catalog));
  if (!catalogRequiresSsoIntegral(catalog)) {
    for (const auth of AUTH_ENTITY_FAMILY) allowed.add(auth);
  }
  return allowed;
}

/** SQL filtrado antes de derivar erDiagram (elimina tablas prohibidas/inventadas). */
export function filterSqlForPaso0ErDiagram(
  sql: string,
  catalog: Paso0DecisionCatalog,
): string {
  const tablesToStrip = listPaso0TablesToStripFromSection3(catalog);
  return stripPaso0TablesFromSection3Sql(sql ?? "", tablesToStrip).sql;
}

/** Filtra bloque erDiagram (sin fences) a entidades canónicas del catálogo. */
export function filterErDiagramContentToCanonicalEntities(
  diagramContent: string,
  catalog: Paso0DecisionCatalog,
): string {
  const allowed = listPaso0AllowedErEntityNames(catalog);
  const lines = (diagramContent ?? "").split("\n");
  const out: string[] = [];
  let skipEntityBlock = false;

  for (const line of lines) {
    const entityOpen = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\s*$/);
    if (entityOpen) {
      const name = entityOpen[1].toLowerCase().replace(/_entity$/, "");
      skipEntityBlock = !allowed.has(name);
      if (!skipEntityBlock) out.push(line);
      continue;
    }
    if (/^\s*\}\s*$/.test(line)) {
      if (!skipEntityBlock) out.push(line);
      skipEntityBlock = false;
      continue;
    }
    if (skipEntityBlock) continue;

    const relMatch = line.match(
      /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+\|\|--o\{\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+:/,
    );
    if (relMatch) {
      const left = relMatch[1].toLowerCase().replace(/_entity$/, "");
      const right = relMatch[2].toLowerCase().replace(/_entity$/, "");
      if (allowed.has(left) && allowed.has(right)) out.push(line);
      continue;
    }
    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function stripPaso0TablesFromSection3Sql(
  sql: string,
  tablesToStrip: Iterable<string>,
): { sql: string; stripped: string[] } {
  let out = sql ?? "";
  const stripped: string[] = [];
  for (const table of tablesToStrip) {
    const createRe = new RegExp(
      `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${paso0CreateTableEntityPattern(table)}\\s*\\(`,
      "i",
    );
    if (!createRe.test(out)) continue;
    out = stripCreateTableFromSql(out, table);
    stripped.push(table);
  }
  return { sql: out, stripped };
}

/** Elimina entidades de diagramas erDiagram en §3 (minimal). */
export function stripPaso0TablesFromErDiagrams(
  section3: string,
  tablesToStrip: Iterable<string>,
): string {
  const tableSet = new Set([...tablesToStrip].map((t) => t.toLowerCase()));
  if (tableSet.size === 0) return section3;

  return section3.replace(/```mermaid\n([\s\S]*?)```/gi, (block, inner: string) => {
    if (!/\berDiagram\b/i.test(inner)) return block;
    const lines = inner.split("\n").filter((line) => {
      const normalized = line.toLowerCase();
      for (const table of tableSet) {
        if (new RegExp(`\\b${table.replace(/_/g, "[_\\s-]*")}\\b`, "i").test(normalized)) {
          return false;
        }
      }
      return true;
    });
    return `\`\`\`mermaid\n${lines.join("\n")}\n\`\`\``;
  });
}

/** Entidades §3 presentes solo por CREATE TABLE (no listas/tablas markdown). */
export function collectPaso0CanonicalTablesPresentInSection3(
  mddMarkdown: string,
): Set<string> {
  const section3 = extractSectionByNumber(mddMarkdown, 3) || mddMarkdown;
  const present = new Set<string>();
  const sqlBlocks = extractSection3SqlBlocks(section3);
  const sqlCorpus = sqlBlocks.length > 0 ? sqlBlocks.join("\n\n") : section3;
  for (const stmt of parseCreateTableStatements(sqlCorpus)) {
    present.add(stmt.name);
  }
  if (sqlBlocks.length === 0) {
    for (const stmt of parseCreateTableStatements(section3)) {
      present.add(stmt.name);
    }
  }
  return present;
}

export function collectMissingPaso0CanonicalTables(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string[] {
  const present = collectPaso0CanonicalTablesPresentInSection3(mddMarkdown);
  const required = listPaso0MandatoryEntities(catalog).filter(
    (e) => !AUTH_ENTITY_FAMILY.has(e) && !isPaso0ForbiddenEntityTable(e),
  );
  return required.filter((e) => !present.has(e));
}

/** Alias §4 aceptado para familia migration-jobs (EXPECTED-MDD §4.2). */
const MIGRATION_JOBS_SECTION4_ALIASES = [
  /\/applications\/(?:\{[^}]+\}|:[^/\s`|]+)\/migration\/jobs/i,
] as const;

function section4MatchesRoutePattern(section4: string, pattern: string): boolean {
  const normalized = pattern.toLowerCase();
  if (section4.toLowerCase().includes(normalized)) return true;
  if (normalized.includes("ingest/events")) {
    if (/\|\s*POST\s*\|[^\\n]*`\/events`/i.test(section4)) return true;
    if (/\|\s*POST\s*\|[^\\n]*\/events\b/i.test(section4) && !/\/ingest\/events/i.test(section4)) {
      return true;
    }
  }
  if (normalized.includes("migration-jobs")) {
    return MIGRATION_JOBS_SECTION4_ALIASES.some((re) => re.test(section4));
  }
  return false;
}

/** Normaliza alias `/events` → `/ingest/events` en filas §4 (D-080). */
export function normalizePaso0IngestEventsRouteAliases(section4Body: string): {
  body: string;
  normalized: string[];
} {
  const normalized: string[] = [];
  const lines = (section4Body ?? "").split(/\r?\n/);
  const out = lines.map((line) => {
    if (!line.trim().startsWith("|")) return line;
    if (/\/ingest\/events/i.test(line)) return line;
    if (!/`\/events`/i.test(line) && !/\|\s*POST\s*\|[^|]*(?<!\/ingest)\/events\b/i.test(line)) {
      return line;
    }
    const next = line
      .replace(/`\/events`/gi, "`/ingest/events`")
      .replace(/(\|\s*POST\s*\|[^|]*?)(?<!\/ingest)\/events\b/gi, "$1/ingest/events");
    if (next !== line) normalized.push("/events→/ingest/events");
    return next;
  });
  return { body: out.join("\n"), normalized };
}

/** Elimina filas §4 `(coherence auto)` para entidades/rutas prohibidas Paso 0. */
export function stripPaso0ForbiddenCoherenceAutoRoutesFromSection4(
  section4Body: string,
  catalog?: Paso0DecisionCatalog | null,
): { body: string; stripped: string[] } {
  const forbiddenRouteRe = buildPaso0ForbiddenRouteLineRe(catalog);
  const forbiddenEntities = buildPaso0ForbiddenEntitySet(catalog);
  const stripped: string[] = [];
  const lines = (section4Body ?? "").split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    if (!line.trim().startsWith("|") || !/\(coherence auto\)/i.test(line)) {
      out.push(line);
      continue;
    }
    const pathMatch = line.match(/`([^`]+)`|(\/[a-z0-9/_:-]+)/i);
    const path = (pathMatch?.[1] ?? pathMatch?.[2] ?? "").replace(/`/g, "");
    const slugFromPath = path
      .match(/\/api\/v1\/([^/`{]+)/i)?.[1]
      ?.replace(/-/g, "_")
      .toLowerCase();
    let skip = false;
    if (path && forbiddenRouteRe.test(line)) skip = true;
    if (slugFromPath && forbiddenEntities.has(slugFromPath)) skip = true;
    if (!skip && (slugFromPath === "requests" || slugFromPath === "request")) skip = true;
    if (skip) {
      stripped.push(path || line.slice(0, 60));
      continue;
    }
    out.push(line);
  }
  return { body: out.join("\n"), stripped };
}

function section4HasRouteFamily(section4: string, family: { pathPatterns: string[]; methods?: string[] }): boolean {
  return family.pathPatterns.some((pattern) => {
    if (!section4MatchesRoutePattern(section4, pattern)) return false;
    if (!family.methods?.length) return true;
    const normalized = pattern.toLowerCase().replace(/\//g, "\\/");
    return family.methods.some((method) => {
      if (new RegExp(`\\|\\s*${method}\\s*\\|[^\\n]*${normalized}`, "i").test(section4)) return true;
      if (new RegExp(`${method}[^\\n]*${normalized}`, "i").test(section4)) return true;
      if (pattern.toLowerCase().includes("migration-jobs")) {
        return new RegExp(
          `\\|\\s*${method}\\s*\\|[^\\n]*\\/applications\\/[^\\n]*\\/migration\\/jobs`,
          "i",
        ).test(section4);
      }
      return false;
    });
  });
}

function extractSection3SqlBlocks(section3: string): string[] {
  return [...(section3 ?? "").matchAll(/```sql\s*\n([\s\S]*?)```/gi)].map((m) => m[1] ?? "");
}

/** Nombres CREATE TABLE repetidos en §3 (entre fences o dentro del corpus). */
export function detectSection3DuplicateCreateTableNames(section3: string): string[] {
  const sqlBlocks = extractSection3SqlBlocks(section3);
  const corpus = sqlBlocks.length > 0 ? sqlBlocks.join("\n\n") : section3;
  const counts = new Map<string, number>();
  for (const stmt of parseCreateTableStatements(corpus)) {
    counts.set(stmt.name, (counts.get(stmt.name) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name);
}

const SECTION3_REPLACE_TRIGGER_RES: readonly RegExp[] = [
  /\bis default\b/i,
  /\bdefault\s+BOOLEAN\b/i,
  /\bMinIO_checksum_sha256\b/i,
  /\bminio_checksum_sha256\b/i,
  /\bobjetos_checksum\b/i,
  /CHECK\s*\(\s*\)/i,
  /^\s*y\s+checksums/im,
  /--\s*Paso 0 canonical stubs/i,
];

/** True cuando §3 debe sustituirse por un único fence SQL canónico (no append híbrido). */
export function shouldReplaceSection3WithPaso0Canonical(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): boolean {
  const section3 = extractSectionByNumber(mddMarkdown, 3) ?? "";
  if (!section3.trim() || !catalog) return false;

  const sqlBlocks = extractSection3SqlBlocks(section3);
  if (sqlBlocks.length === 0) return false;

  if (detectPaso0Section3SqlSyntaxErrors(section3).length > 0) return true;
  if (detectPaso0CorruptedSection3Sql(section3).length > 0) return true;
  if (detectSection3DuplicateCreateTableNames(section3).length > 0) return true;

  const corpus = sqlBlocks.join("\n\n");
  if (SECTION3_REPLACE_TRIGGER_RES.some((re) => re.test(corpus))) return true;

  if (sqlBlocks.length >= 2) return true;

  const hasStubMarker = sqlBlocks.some((b) => /--\s*Paso 0 canonical/i.test(b));
  if (hasStubMarker && sqlBlocks.length > 1) return true;

  return false;
}

/** Alias semántico: colapsa §3 a un solo fence canónico Paso 0. */
export function dedupeSection3ToSingleCanonicalFence(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string {
  return replaceSection3SqlWithPaso0CanonicalStubs(mddMarkdown, catalog);
}

/** Anexo determinista en fence dedicado cuando el merge en el último bloque no satisface el gate. */
function appendPaso0CanonicalStubsFenceToSection3(
  mddMarkdown: string,
  missingEntities: string[],
  catalog: Paso0DecisionCatalog,
): string {
  const stubs = composePaso0CanonicalStubsSql(missingEntities, catalog);
  if (!stubs.trim()) return mddMarkdown;

  const section3 = extractSectionByNumber(mddMarkdown, 3);
  if (!section3) {
    const appendix =
      `\n\n## 3. Modelo de Datos\n\n\`\`\`sql\n-- Paso 0 canonical stubs (force)\n${stubs}\n\`\`\`\n`;
    return `${mddMarkdown.trimEnd()}${appendix}`;
  }

  const appendix =
    `\n\n\`\`\`sql\n-- Paso 0 canonical stubs (force)\n${stubs.trimEnd()}\n\`\`\`\n`;
  const updated = section3.trimEnd() + appendix;
  return mddMarkdown.replace(section3, updated);
}

function sqlBlockHasNestedCreateTable(sql: string): boolean {
  const upper = (sql ?? "").toUpperCase();
  let searchFrom = 0;
  while (searchFrom < sql.length) {
    const idx = upper.indexOf("CREATE TABLE", searchFrom);
    if (idx === -1) break;
    const openIdx = sql.indexOf("(", idx);
    if (openIdx === -1) break;
    let depth = 1;
    for (let i = openIdx + 1; i < sql.length && depth > 0; i += 1) {
      const ch = sql[i]!;
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (depth === 1 && upper.slice(i, i + 12) === "CREATE TABLE") return true;
    }
    searchFrom = idx + 12;
  }
  return false;
}

function countCreateTableStatements(sql: string, tableName: string): number {
  const re = new RegExp(
    `\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${paso0CreateTableEntityPattern(tableName)}\\s*\\(`,
    "gi",
  );
  return (sql.match(re) ?? []).length;
}

/** Blockers §3: DDL anidado corrupto o tablas duplicadas (Paso 0 Workspace Chat). */
export function detectPaso0CorruptedSection3Sql(section3: string): string[] {
  const blockers: string[] = [];
  const sqlBlocks = extractSection3SqlBlocks(section3);
  const corpus = sqlBlocks.length > 0 ? sqlBlocks.join("\n\n") : section3;
  if (sqlBlockHasNestedCreateTable(corpus)) {
    blockers.push(
      "[Paso 0 §3] SQL corrupto: CREATE TABLE anidado dentro de otro CREATE TABLE — reparar fences §3.",
    );
  }
  if (countCreateTableStatements(corpus, "security_events") > 1) {
    blockers.push(
      "[Paso 0 §3] SQL corrupto: CREATE TABLE `security_events` duplicada (>1) — consolidar §3.",
    );
  }
  return blockers;
}

function sqlBlockHasEmbeddedCreateIndex(sql: string): boolean {
  for (const stmt of parseCreateTableStatements(sql ?? "")) {
    const openIdx = stmt.text.indexOf("(");
    const closeIdx = stmt.text.lastIndexOf(")");
    if (openIdx === -1 || closeIdx <= openIdx) continue;
    const body = stmt.text.slice(openIdx + 1, closeIdx);
    if (/CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(body)) return true;
  }
  return false;
}

const SECTION1_FORBIDDEN_ENTITY_RE =
  /\b(tenants?|canales?\s+corporativos?|channels?|conversaciones?\s+generales?|conversations?)\b/i;

/** Quita bullets de entidades prohibidas en listas §1. */
export function sanitizePaso0ForbiddenEntitiesInSection1(section1Body: string): {
  body: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = (section1Body ?? "").split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet?.[1] && SECTION1_FORBIDDEN_ENTITY_RE.test(bullet[1])) {
      warnings.push(`§1: entidad/vocabulario prohibido eliminado — ${bullet[1].slice(0, 80)}`);
      continue;
    }
    let skipLine = false;
    for (const table of PASO0_FORBIDDEN_ENTITY_TABLES) {
      if (new RegExp(`\`${table}\`|\\b${table}\\b`, "i").test(line) && /^\s*[-*]\s+/.test(line)) {
        warnings.push(`§1: tabla prohibida \`${table}\` eliminada de lista de entidades`);
        skipLine = true;
        break;
      }
    }
    if (skipLine) continue;
    out.push(line);
  }

  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

const SECTION1_E2EE_POSTERIOR_RE =
  /\b(?:implementaci[oó]n\s+de\s+)?E2EE\b[^\n.]{0,100}\bposterior\b|\bposterior\b[^\n.]{0,60}\b(?:al\s+)?MVP\b[^\n.]{0,40}\bE2EE\b|\bCifrado\s+E2EE\b[^\n]*\bposterior\b/i;
const SECTION1_AGENT_POSTERIOR_RE =
  /\bagentes?\s+(?:de\s+)?IA\b[^\n.]{0,120}\b(?:posterior|iteraci[oó]n\s+posterior)\b|\b(?:posterior|siguiente)\s+iteraci[oó]n\b[^\n.]{0,80}\bagente/i;
const SECTION1_WRONG_EXPORT_RE =
  /\bexportaci[oó]n\s+masiva\b[^\n.]{0,80}\bno\s+se\s+implementa\s+en\s+MVP\b|\bexport_requests\b[^\n.]{0,80}\bno\s+se\s+implementa\s+en\s+MVP\b/i;
const SECTION1_INVENTED_SLO_RE =
  /\b(?:99\.9\s*%|p99\s*<\s*\d+\s*ms|200\s+(?:req\/s|ops\/s)|reducir\s+en\s+un\s+50\s*%|ventana\s+de\s+tolerancia\s+de\s+5\s+segundos|disponibilidad\s+99)/i;
const SECTION1_WRONG_RETENTION_RE =
  /\b3\s*meses,\s*6\s*meses,\s*1\s*a[nñ]o,\s*2\s*a[nñ]os\s*y\s*5\s*a[nñ]os\b/i;

/** Corrige reclasificaciones erróneas de MVP en §1 (E2EE, agente, exportación, SLAs, retención). */
export function sanitizePaso0Section1MvpAlignment(
  section1Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { body: section1Body ?? "", warnings: [] };
  }
  const warnings: string[] = [];
  const lines = (section1Body ?? "").split(/\r?\n/);
  const out = lines.flatMap((line) => {
    if (SECTION1_E2EE_POSTERIOR_RE.test(line)) {
      warnings.push("§1: E2EE reclasificado a MVP (D-132)");
      return [
        "- **E2EE configurable** por aplicación y contexto en MVP; política fijada antes del primer contenido (D-089, D-132). Recuperación corporativa condicionada a DEP-010 (D-147).",
      ];
    }
    if (SECTION1_AGENT_POSTERIOR_RE.test(line)) {
      warnings.push("§1: agente MCP reclasificado a MVP (D-103)");
      return [
        "- **Agente externo** mediante MCP explícito y de solo lectura en MVP (D-103, D-106). Escritura y E2EE del agente: posterior al MVP (D-105, D-107).",
      ];
    }
    if (SECTION1_WRONG_EXPORT_RE.test(line)) {
      warnings.push("§1: exportación puntual y legal hold en MVP (D-153)");
      return [
        "- **Legal hold y exportación puntual gobernada** en MVP (D-153, D-099). Exportaciones masivas ordinarias y portal Legal: fuera de alcance (D-100).",
      ];
    }
    if (SECTION1_INVENTED_SLO_RE.test(line)) {
      warnings.push("§1: objetivo numérico inventado eliminado (DF-011)");
      return [];
    }
    if (SECTION1_WRONG_RETENTION_RE.test(line)) {
      warnings.push("§1: política de retención corregida (D-098)");
      return [`- **Política de retención:** ${WORKSPACE_CHAT_RETENTION_GLOSSARY_TEXT}`];
    }
    return [line];
  });
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Elimina filas NFR inventadas (DF-011) en §2 y líneas §7 con SLAs no acordados. */
export function sanitizePaso0InventedSlosInSection2(
  section2Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { body: section2Body ?? "", warnings: [] };
  }
  const warnings: string[] = [];
  const lines = (section2Body ?? "").split(/\r?\n/);
  const out = lines.filter((line) => {
    if (!SECTION1_INVENTED_SLO_RE.test(line)) return true;
    warnings.push(`§2: objetivo numérico inventado eliminado — ${line.slice(0, 72)}`);
    return false;
  });
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Elimina SLAs inventados embebidos en §7 (JSON/flujo). */
export function sanitizePaso0InventedSlosInSection7(
  section7Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { body: section7Body ?? "", warnings: [] };
  }
  const warnings: string[] = [];
  const lines = (section7Body ?? "").split(/\r?\n/);
  const out = lines.filter((line) => {
    if (!SECTION1_INVENTED_SLO_RE.test(line)) return true;
    warnings.push(`§7: objetivo numérico inventado eliminado — ${line.slice(0, 72)}`);
    return false;
  });
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Normaliza prosa break-glass dual → aprobador único global_admin (D-150) en §4/§7. */
export function sanitizePaso0DualApprovalProseInBody(
  body: string,
  catalog: Paso0DecisionCatalog,
  label: string,
): { body: string; warnings: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { body: body ?? "", warnings: [] };
  }
  const warnings: string[] = [];
  const lines = (body ?? "").split(/\r?\n/);
  const out = lines.flatMap((line) => {
    if (!BREAK_GLASS_DUAL_APPROVE_RES.some((re) => re.test(line)) && !/approve-(?:first|second)/i.test(line)) {
      return [line];
    }
    warnings.push(`${label}: break-glass dual→single — ${line.slice(0, 72)}`);
    if (/Flujo de aprobación de break-glass/i.test(line)) {
      return [
        "Flujo de aprobación de break-glass (D-150): (1) Solicitud con motivo y alcance; (2) POST `/break-glass-requests`; (3) notificación a `global_admin`; (4) PATCH `/break-glass-requests/{id}/approve` por aprobador distinto del solicitante; (5) ventana temporal auditada en `audit_entries`; (6) expiración automática.",
      ];
    }
    if (/Nota del arquitecto/i.test(line)) {
      return [
        line
          .replace(/aprobación\s+dual[^.]*\./gi, "aprobación única por global_admin (D-150).")
          .replace(/approve-first|approve-second/gi, "approve"),
      ];
    }
    return [
      line
        .replace(/\bfirst_approved\b/gi, "approved")
        .replace(/\bapprove-first\b/gi, "approve")
        .replace(/\bapprove-second\b/gi, "approve")
        .replace(/\bsegundo aprobador\b/gi, "global_admin")
        .replace(/\bprimer aprobador\b/gi, "global_admin")
        .replace(/\baprobación\s+dual\b/gi, "aprobación única (global_admin)"),
    ];
  });
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Repara break-glass/export dual-aprobación en §3 SQL y technicalmetadata (D-150). */
export function sanitizePaso0DualApprovalInSection3(
  section3Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog)) {
    return { body: section3Body ?? "", warnings: [] };
  }
  const warnings: string[] = [];
  let body = section3Body ?? "";
  const needsDualRepair =
    BREAK_GLASS_DUAL_APPROVE_RES.some((re) => re.test(body)) ||
    /\bapproved_by\b[\s\S]{0,1200}\bapproved_by\b/i.test(body) ||
    /REFERENCES\s+users\s*\(\s*id\s*\)/i.test(body) ||
    /"dual_approval_tables"/i.test(body);
  if (!needsDualRepair) {
    return { body, warnings };
  }
  body = body
    .replace(/\bfirst_approver_id\b/gi, "approved_by")
    .replace(/\bsecond_approver_id\b/gi, "approved_by")
    .replace(/\brequester_id\b/gi, "requested_by")
    .replace(/,\s*CONSTRAINT chk_(?:break_glass|export)_different_approvers[^\n]*/gi, "")
    .replace(/,\s*CONSTRAINT chk_different_approvers[^\n]*/gi, "")
    .replace(/'first_approved'/gi, "'approved'")
    .replace(/\bfirst_approved\b/gi, "approved")
    .replace(
      /CONSTRAINT chk_break_glass_status CHECK \(status IN \([^)]+\)\)/gi,
      "CONSTRAINT chk_break_glass_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'completed'))",
    )
    .replace(
      /CONSTRAINT chk_export_status CHECK \(status IN \([^)]+\)\)/gi,
      "CONSTRAINT chk_export_status CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))",
    )
    .replace(/\[dual_approval\][\s\S]*?(?=\n\[|\n```|$)/gi, "");
  body = body.replace(/"dual_approval_tables"\s*:\s*\[[^\]]*\]/gi, '"dual_approval_tables": []');
  warnings.push("§3: break-glass/export normalizado a aprobador único (D-150)");
  return { body, warnings };
}

/** Inserta advertencia D-162 si §2 documenta stack concreto como requisito. */
export function ensurePaso0Section2StackProposalFraming(
  section2Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!isWorkspaceChatPaso0Catalog(catalog) || !catalogRequiresStackAsProposal(catalog)) {
    return { body: section2Body ?? "", warnings: [] };
  }
  const body = section2Body ?? "";
  if (/D-162|propuesta.*no.*decisi[oó]n\s+de\s+dominio|no\s+es\s+decisi[oó]n\s+de\s+dominio/i.test(body)) {
    return { body, warnings: [] };
  }
  const mentionsStack = /\b(postgres|postgresql|nestjs|kong|meilisearch|minio|react\s+native|socket\.io|kubernetes|typeorm)\b/i.test(
    body,
  );
  if (!mentionsStack) return { body, warnings: [] };

  const note =
    "> **Advertencia de lectura (D-162).** Las tecnologías concretas de esta sección son " +
    "**propuestas**, no decisiones de dominio. Lo vinculante son los invariantes " +
    "(aislamiento por aplicación, clientes compartiendo contratos, entrega durable, etc.).\n\n";
  if (body.trimStart().startsWith("> **Advertencia de lectura (D-162)**")) {
    return { body, warnings: [] };
  }
  return { body: `${note}${body.trimStart()}`, warnings: ["§2: marco D-162 propuesta insertado"] };
}

/** Blocker §6: placeholders o contenido insuficiente. */
export function detectPaso0Section6PlaceholderBlocker(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string[] {
  if (!isWorkspaceChatPaso0Catalog(catalog)) return [];
  const section6 = extractSectionByNumber(mddMarkdown, 6);
  if (!section6?.trim()) {
    return ["[Paso 0 §6] Sección Seguridad ausente — hidratar desde EXPECTED-MDD §6."];
  }
  const body = section6.replace(/^##[^\n]+\n?/, "").trim();
  if (paso0Section6NeedsHydration(body)) {
    return [
      "[Paso 0 §6] §6 incompleto o con placeholders — hidratar contenido canónico (EXPECTED-MDD §6.1–§6.8).",
    ];
  }
  return [];
}

function buildPaso0ForbiddenRouteLineRe(catalog?: Paso0DecisionCatalog | null): RegExp {
  const segments = listPaso0ForbiddenApiRouteSegmentsForCatalog(catalog);
  return new RegExp(segments.map((s) => s.replace(/\//g, "\\/")).join("|"), "i");
}

function paso0ForbiddenRouteMatchOptions(catalog?: Paso0DecisionCatalog | null) {
  return catalog && catalogRequiresSsoIntegral(catalog)
    ? { allowSegments: PASO0_SSO_ALLOWED_AUTH_ROUTE_SEGMENTS }
    : undefined;
}

function extractApiPathsFromSection4Line(line: string): string[] {
  const paths: string[] = [];
  for (const m of line.matchAll(/`([^`]+)`|(\/(?:api\/v1\/)?[a-z0-9][a-z0-9/_:-]*)/gi)) {
    const p = (m[1] ?? m[2] ?? "").replace(/`/g, "").trim();
    if (p.startsWith("/")) paths.push(p);
  }
  const heading = line.match(/^#{2,4}\s*(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)/i);
  if (heading?.[1]?.startsWith("/")) paths.push(heading[1].replace(/`/g, ""));
  return paths;
}

function section4LineHasForbiddenRoute(
  line: string,
  catalog?: Paso0DecisionCatalog | null,
): boolean {
  const segments = listPaso0ForbiddenApiRouteSegmentsForCatalog(catalog);
  const matchOpts = paso0ForbiddenRouteMatchOptions(catalog);
  return extractApiPathsFromSection4Line(line).some((path) =>
    apiPathMatchesPaso0ForbiddenSegment(path, segments, matchOpts),
  );
}

/** Normaliza alias break-glass → `/break-glass-requests` (EXPECTED-MDD §4.2). */
export function normalizePaso0BreakGlassRouteAliases(section4Body: string): {
  body: string;
  normalized: string[];
} {
  const normalized: string[] = [];
  const out = (section4Body ?? "").split(/\r?\n/).map((line) => {
    if (!/\/break-glass\//i.test(line) && !/\/break-glass-requests/i.test(line)) return line;
    const next = line
      .replace(/`\/break-glass\/requests`/gi, "`/break-glass-requests`")
      .replace(/`\/break-glass\/request`/gi, "`/break-glass-requests`")
      .replace(/(\|\s*(?:GET|POST|PATCH|DELETE)\s*\|[^|]*?)\/break-glass\/requests\b/gi, "$1/break-glass-requests")
      .replace(/(\|\s*(?:GET|POST|PATCH|DELETE)\s*\|[^|]*?)\/break-glass\/request\b/gi, "$1/break-glass-requests");
    if (next !== line) normalized.push("/break-glass/requests→/break-glass-requests");
    return next;
  });
  return { body: out.join("\n"), normalized: [...new Set(normalized)] };
}

/** Elimina filas §4 con rutas /tenants, /channels, auth local (SSO), etc. */
export function stripPaso0ForbiddenApiRoutesFromSection4(
  section4Body: string,
  catalog?: Paso0DecisionCatalog | null,
): {
  body: string;
  strippedRoutes: string[];
} {
  const strippedRoutes: string[] = [];
  const lines = (section4Body ?? "").split(/\r?\n/);
  const out: string[] = [];
  let skipContractBlock = false;

  for (const line of lines) {
    if (/^#{2,4}\s*(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//i.test(line)) {
      if (section4LineHasForbiddenRoute(line, catalog)) {
        const path = extractApiPathsFromSection4Line(line)[0] ?? line.slice(0, 60);
        strippedRoutes.push(path);
        skipContractBlock = true;
        continue;
      }
      skipContractBlock = false;
      out.push(line);
      continue;
    }
    if (skipContractBlock) {
      if (/^#{1,4}\s/.test(line) && !/^#{5,}/.test(line)) {
        skipContractBlock = section4LineHasForbiddenRoute(line, catalog);
        if (skipContractBlock) {
          strippedRoutes.push(extractApiPathsFromSection4Line(line)[0] ?? line.slice(0, 60));
          continue;
        }
      } else if (line.trim().startsWith("|") || /^#{1,3}\s/.test(line)) {
        skipContractBlock = false;
      } else if (line.trim().length > 0) {
        continue;
      } else {
        continue;
      }
    }
    if (line.trim().startsWith("|") && section4LineHasForbiddenRoute(line, catalog)) {
      const path = extractApiPathsFromSection4Line(line)[0] ?? line.slice(0, 60);
      strippedRoutes.push(path);
      continue;
    }
    if (!line.trim().startsWith("|") && section4LineHasForbiddenRoute(line, catalog)) {
      strippedRoutes.push(extractApiPathsFromSection4Line(line)[0] ?? line.slice(0, 60));
      continue;
    }
    out.push(line);
  }

  return { body: out.join("\n"), strippedRoutes };
}

function formatPaso0MandatoryRouteRow(family: Paso0ApiRouteFamily, method: string, path: string): string {
  const label = `${family.label} (paso0 — auto)`;
  const auth = "credencial de aplicación";
  const ids = family.decisionIds?.join(", ") ?? "MVP";
  return `| ${method} | \`${path}\` | ${label} | ${auth} | ${ids} |`;
}

function paso0MandatoryRouteRowsForFamily(family: Paso0ApiRouteFamily): string[] {
  const methods = family.methods?.length ? family.methods : ["POST"];
  const paths = family.pathPatterns.length ? family.pathPatterns : ["/unknown"];
  const rows: string[] = [];
  for (const method of methods) {
    for (const path of paths) {
      rows.push(formatPaso0MandatoryRouteRow(family, method, path));
    }
  }
  return rows;
}

/** Inyecta filas §4 para familias MVP ausentes (EXPECTED-MDD §4.2 — críticas y no críticas). */
export function injectMissingPaso0MandatoryRoutesIntoSection4(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
  options?: { criticalOnly?: boolean },
): { markdown: string; injected: string[] } {
  const section4 = extractSectionByNumber(mddMarkdown, 4);
  if (!section4) return { markdown: mddMarkdown, injected: [] };

  const body = section4.replace(/^##[^\n]+\n?/, "").trim();
  const families = listPaso0MandatoryRouteFamilies(catalog).filter((f) =>
    options?.criticalOnly ? Boolean(f.critical) : true,
  );
  const missing = families.filter((f) => !section4HasRouteFamily(body, f));

  if (missing.length === 0) return { markdown: mddMarkdown, injected: [] };

  const rows = missing.flatMap(paso0MandatoryRouteRowsForFamily);
  const block =
    `\n\n### Rutas MVP Paso 0 (auto)\n\n` +
    `| Método | Ruta | Descripción | Auth | Notas |\n` +
    `|--------|------|-------------|------|-------|\n` +
    rows.join("\n") +
    `\n`;

  return {
    markdown: replaceSectionBody(mddMarkdown, 4, body.trimEnd() + block),
    injected: missing.map((f) => f.id),
  };
}

const LOCAL_AUTH_RE =
  /\b(contraseña\s+local|password\s+local|registro\s+de\s+usuarios|mfa\s+propio|totp\s+propio|autenticaci[oó]n\s+local|login\s+con\s+contraseña|login\s+propio|login\/password|hashing\s+de\s+contraseñas|argon2id\s+para\s+contraseñas|bcrypt\b|refresh_tokens?\b[^\n.]{0,80}\b(user|person|usuario|identidad|personas)\b|totp_secret\b|mfa_secrets?\b|TOTP\s+obligatorio|MFA\s+TOTP\s+obligatorio|MFA\s+TOTP\b|TOTP\s+RFC\s+6238\s+obligatorio|JWT_PRIVATE_KEY\b|JWT_SECRET\b|hashing_rounds\b|contraseña\s+y\s+MFA|"authentication"\s*:\s*"[^"]*password[^"]*"|"hashing_algorithm"\s*:|"mfa_strategy"\s*:\s*"TOTP")\b/i;

const DBGA_EXTRACTED_ENTITIES_RE =
  /\n(?:#{1,3}\s*)?\*{0,2}Entidades y capacidades extra[ií]das del DBGA\*{0,2}[\s\S]*?(?=\n#{1,3}\s|\n##\s*[2-9]\.\s|$)/gi;

const BREAK_GLASS_DUAL_APPROVE_RES: readonly RegExp[] = [
  /approve-first/i,
  /approve-second/i,
  /\bfirst_approver_id\b/i,
  /\bsecond_approver_id\b/i,
  /\bprimer_aprobador_id\b/i,
  /\bsegundo_aprobador_id\b/i,
  /\bfirst_approved\b/i,
  /\bsegunda\s+aprobación\b/i,
  /\baprobación\s+dual\b/i,
];

/** Quita bloque DBGA pegado en Propósito §1 y expande glosario si quedan placeholders. */
export function stripPaso0DbgaLeakFromSection1(
  section1Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  const warnings: string[] = [];
  let body = (section1Body ?? "").replace(DBGA_EXTRACTED_ENTITIES_RE, "\n");
  if (body !== section1Body) {
    warnings.push("§1: bloque «Entidades y capacidades extraídas del DBGA» eliminado");
  }
  const glossary = expandPaso0GlossaryPlaceholdersInSection1(body, catalog);
  if (glossary.expanded.length > 0) {
    body = glossary.body;
    warnings.push(...glossary.expanded.map((t) => `§1: glosario expandido — ${t}`));
  }
  return { body: body.replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

function lineReferencesBreakGlassDualApproval(line: string): boolean {
  if (!/break-glass|break_glass/i.test(line ?? "")) return false;
  return BREAK_GLASS_DUAL_APPROVE_RES.some((re) => re.test(line));
}

function linePromotesMfaTotp(line: string): boolean {
  const text = (line ?? "").trim();
  if (!text) return false;
  if (/\b(sin|without|no)\s+[^.\n]{0,60}\b(mfa\s+propio|totp|TOTP|mfa_secrets?|totp_secret)\b/i.test(text)) {
    return false;
  }
  return /\b(totp_secret|mfa_secrets?|TOTP\s+obligatorio|MFA\s+TOTP\s+obligatorio|TOTP\s+RFC\s+6238\s+obligatorio|mfa\s+propio|totp\s+propio|"mfa_strategy"\s*:\s*"TOTP")\b/i.test(
    text,
  );
}

/** Normaliza break-glass a aprobador único global_admin (D-150) en §4. */
export function normalizePaso0BreakGlassSingleApproverInSection4(section4Body: string): {
  body: string;
  normalized: string[];
} {
  const normalized: string[] = [];
  const lines = (section4Body ?? "").split(/\r?\n/);
  const out: string[] = [];
  let skipBlock = false;

  for (const line of lines) {
    if (/^#{2,4}\s*(?:GET|POST|PUT|PATCH|DELETE)/i.test(line)) {
      if (lineReferencesBreakGlassDualApproval(line) || /approve-(?:first|second)/i.test(line)) {
        skipBlock = /break-glass|approve-(?:first|second)/i.test(line);
        if (skipBlock) {
          normalized.push(`removed-heading:${line.slice(0, 60)}`);
          continue;
        }
      }
      skipBlock = false;
      out.push(line);
      continue;
    }
    if (skipBlock) {
      if (/^#{1,4}\s/.test(line)) skipBlock = false;
      else continue;
    }
    if (line.trim().startsWith("|") && /approve-(?:first|second)/i.test(line)) {
      normalized.push("removed-dual-approve-row");
      continue;
    }
    if (lineReferencesBreakGlassDualApproval(line)) {
      normalized.push(`normalized-line:${line.slice(0, 60)}`);
      const next = line
        .replace(/approve-first/gi, "approve")
        .replace(/approve-second/gi, "approve")
        .replace(/\bfirst_approver_id\b/gi, "approved_by")
        .replace(/\bsecond_approver_id\b/gi, "approved_by")
        .replace(/\baprobación\s+dual\b/gi, "aprobación única (global_admin)")
        .replace(/\bsegunda\s+aprobación\b/gi, "aprobación (global_admin)");
      out.push(next);
      continue;
    }
    out.push(line);
  }

  let body = out.join("\n");
  if (!/\/break-glass-requests[^/\n]*\/approve/i.test(body)) {
    const row =
      "| POST | `/break-glass-requests/{id}/approve` | Aprobar break-glass (global_admin, distinto del solicitante) | global_admin | D-150 |";
    if (!body.includes("Rutas MVP Paso 0")) {
      body =
        `${body.trimEnd()}\n\n### Break-glass Paso 0 (auto)\n\n| Método | Ruta | Descripción | Auth | Notas |\n|--------|------|-------------|------|-------|\n${row}\n`;
    } else {
      body = `${body.trimEnd()}\n${row}\n`;
    }
    normalized.push("injected-break-glass-approve");
  }
  return { body: body.replace(/\n{3,}/g, "\n\n").trim(), normalized };
}

/** Normaliza break-glass a aprobador único en §6. */
export function normalizePaso0BreakGlassSingleApproverInSection6(section6Body: string): {
  body: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = (section6Body ?? "").split(/\r?\n/);
  const out = lines.flatMap((line) => {
    if (!lineReferencesBreakGlassDualApproval(line)) return [line];
    warnings.push(`§6 break-glass dual→single — ${line.slice(0, 80)}`);
    return [
      line
        .replace(/\bfirst_approver_id\b/gi, "approved_by")
        .replace(/\bsecond_approver_id\b/gi, "approved_by")
        .replace(/\bapprove-first\b/gi, "approve")
        .replace(/\bapprove-second\b/gi, "approve")
        .replace(/\baprobación\s+dual\b/gi, "aprobación única (global_admin)")
        .replace(/\bsegunda\s+aprobación\b/gi, "aprobación (global_admin)"),
    ];
  });
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Elimina referencias a security_events en §6 cuando la tabla no está en §3. */
export function sanitizePaso0SecurityEventsReferencesInSection6(
  section6Body: string,
  mddMarkdown: string,
  catalog?: Paso0DecisionCatalog | null,
): { body: string; warnings: string[] } {
  const present = collectPaso0CanonicalTablesPresentInSection3(mddMarkdown);
  const stripSecurityEvents =
    catalog && catalogRequiresSsoIntegral(catalog)
      ? !present.has("security_events")
      : !present.has("security_events");
  if (!stripSecurityEvents) return { body: section6Body ?? "", warnings: [] };

  const warnings: string[] = [];
  const lines = (section6Body ?? "").split(/\r?\n/);
  const out = lines.flatMap((line) => {
    if (!/\bsecurity_events\b/i.test(line)) return [line];
    warnings.push(`§6: security_events→audit_entries — ${line.slice(0, 80)}`);
    if (/CREATE\s+TABLE\s+security_events/i.test(line)) return [];
    return [line.replace(/\bsecurity_events\b/gi, "audit_entries")];
  });
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Sanea MFA/TOTP en §1/§3/§6 cuando D-003 exige SSO integral. */
export function sanitizePaso0MfaTotpInMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; warnings: string[] } {
  if (!catalogRequiresSsoIntegral(catalog)) {
    return { markdown: mddMarkdown ?? "", warnings: [] };
  }
  let markdown = repairSection3SqlInMdd(mddMarkdown ?? "");
  const warnings: string[] = [];
  for (const num of [1, 6, 7] as const) {
    const section = extractSectionByNumber(markdown, num);
    if (!section) continue;
    const body = section.replace(/^##[^\n]+\n?/, "").trim();
    const lines = body.split(/\r?\n/);
    const out: string[] = [];
    for (const line of lines) {
      if (linePromotesMfaTotp(line) || linePromotesLocalAuth(line)) {
        warnings.push(`§${num}: MFA/TOTP eliminado — ${line.slice(0, 80)}`);
        continue;
      }
      out.push(
        line
          .replace(/\bsecurity_events\b/gi, "audit_entries")
          .replace(/"mfa_strategy"\s*:\s*"TOTP"/gi, '"mfa_strategy": "SSO"')
          .replace(/"hashing_algorithm"\s*:\s*"bcrypt"/gi, '"hashing_algorithm": "none"')
          .replace(/"hashing_algorithm"\s*:\s*"Argon2id"/gi, '"hashing_algorithm": "none"')
          .replace(/"hashing_rounds"\s*:\s*\d+/gi, '"hashing_rounds": 0')
          .replace(/\bJWT_PRIVATE_KEY\b/g, "SSO_JWKS_URL")
          .replace(/\bJWT_SECRET\b/g, "SSO_JWKS_URL"),
      );
    }
    const sanitized = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (sanitized !== body) markdown = replaceSectionBody(markdown, num, sanitized);
  }
  return { markdown, warnings };
}

/** Evita eliminar §6 SSO correcto («Sin MFA propio…», «sin auth local»). */
function linePromotesLocalAuth(line: string): boolean {
  const text = (line ?? "").trim();
  if (!text || !LOCAL_AUTH_RE.test(text)) return false;
  if (
    /\b(sin|without|no)\s+[^.\n]{0,60}\b(mfa\s+propio|contraseña\s+local|password\s+local|auth\s+local|hashing\s+de\s+contraseñas|registro\s+de\s+usuarios)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  return true;
}

const STRANGLER_FIG_RE =
  /\b(strangler\s+fig|estrangulamiento\s+incremental|enrutamiento\s+entre\s+sistema\s+legado|patr[oó]n\s+saga.*strangler|strangler.*\bsaga\b)\b/i;
const STRANGLER_FIG_SANITIZE_RE =
  /\b(strangler\s+fig|estrangulamiento\s+incremental|convivencia\s+operativa\s+permanente|enrutamiento\s+entre\s+sistema\s+legado|patr[oó]n\s+saga.*strangler|strangler.*\bsaga\b|migraci[oó]n\s+incremental\s+con\s+teams)\b/i;

const SECTION3_SQL_SYNTAX_RES: readonly RegExp[] = [
  /\bis default\b/i,
  /\bdefault\s+BOOLEAN\b/i,
  /\bcontent text TEXT\b/i,
  /\bcontent text\b/i,
  /\bquery text TEXT\b/i,
  /\bquery text\b/i,
  /\bS3_checksum_sha256\b/i,
  /REFERENCES\s+users\s*\(\s*id\s*\)/i,
  /\bapproved_by\b[\s\S]{0,400}\bapproved_by\b/i,
  /\bobjetos_checksum\b/i,
  /idx_audit_identity[^\n]*identity_id/i,
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b[\s\S]*idempotency_key/i,
  /idx_business_events_context[^\n]*\(\s*(?!context_id)/i,
  /purged_by[^\n]*o UUID de identity/i,
];

/** Detecta errores de sintaxis SQL §3 no reparables automáticamente (blockers gate). */
export function detectPaso0Section3SqlSyntaxErrors(section3: string): string[] {
  const blockers: string[] = [];
  const sqlBlocks = extractSection3SqlBlocks(section3);
  const corpus = sqlBlocks.length > 0 ? sqlBlocks.join("\n\n") : section3;
  for (const re of SECTION3_SQL_SYNTAX_RES) {
    if (re.test(corpus)) {
      blockers.push(
        "[Paso 0 §3] SQL con error de sintaxis o CREATE INDEX embebido — reparar §3 antes de persistir.",
      );
      break;
    }
  }
  if (sqlBlockHasEmbeddedCreateIndex(corpus)) {
    blockers.push(
      "[Paso 0 §3] SQL con error de sintaxis o CREATE INDEX embebido — reparar §3 antes de persistir.",
    );
  }
  const indexes = extractCreateIndexStatements(corpus);
  if (indexes.length !== dedupeCreateIndexStatements(indexes).length) {
    blockers.push("[Paso 0 §3] CREATE INDEX duplicados en §3 — consolidar índices.");
  }
  return blockers;
}

export function detectPaso0LocalAuthPatterns(
  mddMarkdown: string,
  catalog?: Paso0DecisionCatalog | null,
): string[] {
  const section6 = extractSectionByNumber(mddMarkdown, 6) ?? "";
  const section1 = extractSectionByNumber(mddMarkdown, 1) ?? "";
  const section3 = extractSectionByNumber(mddMarkdown, 3) ?? "";
  const section4 = extractSectionByNumber(mddMarkdown, 4) ?? "";
  const corpus = `${section1}\n${section4}\n${section6}\n${section3}`;
  const requiresSso = catalog ? catalogRequiresSsoIntegral(catalog) : /\b(sso\s+integral|d-003)\b/i.test(corpus);
  if (!requiresSso) return [];
  const lines = corpus.split(/\r?\n/);
  if (!lines.some((line) => linePromotesLocalAuth(line))) return [];
  return [
    "[Paso 0 §6] Patrones de auth local (contraseña/MFA/TOTP/bcrypt/refresh_tokens de usuarios) incompatibles con D-003 (SSO Integral).",
  ];
}

function stripLocalAuthLinesFromBody(
  body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!catalogRequiresSsoIntegral(catalog)) return { body: body ?? "", warnings: [] };
  const warnings: string[] = [];
  let sanitized = (body ?? "").replace(/```json\n([\s\S]*?)```/gi, (block, inner: string) => {
    if (
      !/hashing_rounds|mfa_strategy|login\/password|JWT_PRIVATE_KEY|JWT_SECRET|hashing_algorithm|bcrypt|contraseña|MFA\s+TOTP/i.test(
        inner,
      )
    ) {
      return block;
    }
    warnings.push("manifest JSON auth local eliminado (D-003 SSO Integral)");
    return `\`\`\`json
{
  "security": {
    "authentication": "SSO OIDC (D-003 — identity provider externo)",
    "mfa_strategy": "SSO",
    "hashing_algorithm": "none",
    "hashing_rounds": 0
  }
}
\`\`\``;
  });

  const lines = sanitized.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (
      linePromotesLocalAuth(line) ||
      linePromotesMfaTotp(line) ||
      /CREATE\s+TABLE\s+refresh_tokens/i.test(line) ||
      /\bJWT_PRIVATE_KEY\b|\bJWT_SECRET\b|"hashing_rounds"\s*:/i.test(line)
    ) {
      warnings.push(`auth local eliminado — ${line.slice(0, 80)}`);
      continue;
    }
    out.push(line);
  }
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

/** Elimina bullets §6 contradictorios con SSO Integral (D-003). */
export function sanitizePaso0SsoContradictionsInSection6(
  section6Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  return stripLocalAuthLinesFromBody(section6Body, catalog);
}

/** Sanea §1/§3/§6 antes del delivery gate cuando D-003 exige SSO integral. */
export function sanitizePaso0SsoContradictionsInMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; warnings: string[] } {
  if (!catalogRequiresSsoIntegral(catalog)) {
    return { markdown: mddMarkdown ?? "", warnings: [] };
  }
  let markdown = mddMarkdown ?? "";
  const warnings: string[] = [];
  for (const num of [1, 3, 6, 7] as const) {
    const section = extractSectionByNumber(markdown, num);
    if (!section) continue;
    const body = section.replace(/^##[^\n]+\n?/, "").trim();
    const sanitized = stripLocalAuthLinesFromBody(body, catalog);
    if (sanitized.body !== body || sanitized.warnings.length > 0) {
      markdown = replaceSectionBody(markdown, num, sanitized.body);
      warnings.push(...sanitized.warnings.map((w) => `§${num}: ${w}`));
    }
  }
  return { markdown, warnings };
}

/** Elimina bullets Strangler Fig cuando D-121 lo descarta (§2, §7 u otro cuerpo). */
export function sanitizePaso0StranglerPatternsInBody(
  body: string,
  catalog: Paso0DecisionCatalog,
  sectionLabel = "§2",
): { body: string; warnings: string[] } {
  if (!catalogMarksStranglerOutOfScope(catalog)) return { body: body ?? "", warnings: [] };
  const warnings: string[] = [];
  const lines = (body ?? "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (STRANGLER_FIG_SANITIZE_RE.test(line)) {
      warnings.push(
        `${sectionLabel}: Strangler Fig eliminado (D-121 — corte por campaña, sin convivencia permanente) — ${line.slice(0, 80)}`,
      );
      continue;
    }
    out.push(line);
  }
  const note =
    PASO0_D121_MIGRATION_NOTE;
  const resultBody = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (warnings.length > 0 && !/D-121.*corte por campaña/i.test(resultBody)) {
    return { body: resultBody + note, warnings };
  }
  return { body: resultBody, warnings };
}

/** Elimina bullets §2 Strangler Fig cuando D-121 lo descarta. */
export function sanitizePaso0StranglerPatternsInSection2(
  section2Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  return sanitizePaso0StranglerPatternsInBody(section2Body, catalog, "§2");
}

const PASO0_D121_MIGRATION_NOTE =
  "\n\n> **Nota Paso 0 (D-121):** Migración OBP por corte de campaña (congelamiento, delta, solo lectura temporal); no convivencia operativa permanente ni enrutamiento legacy↔nuevo en runtime.\n";

/**
 * Sanea Strangler Fig activo en §2/§6/§7 antes del delivery gate / persist (D-121).
 * Idempotente: la nota D-121 solo se añade una vez por sección saneada.
 */
export function sanitizePaso0StranglerFigInMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; warnings: string[] } {
  if (!catalogMarksStranglerOutOfScope(catalog)) {
    return { markdown: mddMarkdown ?? "", warnings: [] };
  }
  let markdown = mddMarkdown ?? "";
  const warnings: string[] = [];
  for (const num of [2, 6, 7] as const) {
    const section = extractSectionByNumber(markdown, num);
    if (!section) continue;
    const body = section.replace(/^##[^\n]+\n?/, "").trim();
    const sanitized = sanitizePaso0StranglerPatternsInBody(body, catalog, `§${num}`);
    if (sanitized.warnings.length > 0 || sanitized.body !== body) {
      markdown = replaceSectionBody(markdown, num, sanitized.body);
      warnings.push(...sanitized.warnings);
    }
  }
  return { markdown, warnings };
}

/** True si todos los blockers Paso 0 son Strangler Fig (reparables sin LLM). */
export function areOnlyStranglerFigPaso0Blockers(blockers: string[]): boolean {
  const items = blockers.filter((b) => b.trim().length > 0);
  if (items.length === 0) return false;
  return items.every((b) => /Strangler Fig documentado/i.test(b));
}

/**
 * Bloque wizard [ARQUITECTURA INMUTABLE] no se modifica (elección del usuario).
 * La aclaración D-121 va en §2/§7 vía `sanitizePaso0StranglerPatternsInBody`.
 */
export function sanitizePaso0StranglerInGovernanceSection(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; warnings: string[] } {
  return deselectStranglerFigInGovernanceWizard(mddMarkdown ?? "", catalog);
}

const GLOSSARY_PLACEHOLDER_RE = /t[eé]rmino del dominio descrito en el alcance\.?/i;

const PASO0_GLOSSARY_FALLBACK_DEFINITIONS: Readonly<Record<string, string>> = {
  "capacidades de negocio (mvp)":
    "Conjunto de funcionalidades del MVP respaldadas por decisiones D-ID del catálogo Paso 0; excluye capacidades fuera de alcance explícito.",
  "capacidades de negocio":
    "Funcionalidades de producto incluidas en el alcance del MVP según el catálogo de decisiones D-ID.",
  "instrucciones para agentes":
    "Directrices vinculantes para agentes de IA: respetar vocabulario cerrado, trazabilidad D-ID y no introducir capacidades sin respaldo normativo.",
};

function lineHasGlossaryPlaceholder(line: string): boolean {
  return GLOSSARY_PLACEHOLDER_RE.test(line ?? "");
}

function extractGlossaryTermFromLine(line: string): string | null {
  const bold = line.match(/\*\*([^*]+?):*\*\*/);
  if (bold?.[1]) return bold[1].replace(/:+$/, "").replace(/`/g, "").trim();
  const bullet = line.match(/^\s*[-*]\s+\*\*([^*]+?):*\*\*/);
  return bullet?.[1]?.replace(/:+$/, "").replace(/`/g, "").trim() ?? null;
}

function lookupPaso0GlossaryDefinition(
  term: string,
  termSources: ReadonlyArray<{ term: string; definition: string }>,
): string | null {
  const normalized = term.toLowerCase().replace(/\s+/g, " ").trim();
  for (const e of termSources) {
    const rawTerm = e.term.replace(/\*\*/g, "").replace(/`/g, "").trim();
    const key = rawTerm.toLowerCase();
    if (key === normalized || normalized.includes(key) || key.includes(normalized)) {
      return e.definition.slice(0, 240);
    }
  }
  for (const [key, definition] of Object.entries(PASO0_GLOSSARY_FALLBACK_DEFINITIONS)) {
    if (normalized === key || normalized.includes(key) || key.includes(normalized)) {
      return definition;
    }
  }
  return null;
}

/** Sustituye placeholders genéricos del glosario §1 por definiciones del catálogo Paso 0. */
export function expandPaso0GlossaryPlaceholdersInSection1(
  section1Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; expanded: string[] } {
  const expanded: string[] = [];
  if (!GLOSSARY_PLACEHOLDER_RE.test(section1Body ?? "")) {
    return { body: section1Body, expanded };
  }
  const enriched = enrichPaso0DecisionCatalog(catalog);
  const termSources = [
    ...(enriched.entities ?? []),
    ...(isWorkspaceChatPaso0Catalog(enriched) ? WORKSPACE_CHAT_GLOSSARY_TERMS : []),
  ];
  const lines = (section1Body ?? "").split(/\r?\n/);
  const out = lines.map((line) => {
    if (!lineHasGlossaryPlaceholder(line)) return line;
    const termFromLine = extractGlossaryTermFromLine(line);
    const candidates = [
      termFromLine,
      ...termSources
        .map((e) => e.term.replace(/\*\*/g, "").trim())
        .filter((t) => t.length >= 2 && line.toLowerCase().includes(t.toLowerCase())),
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const definition = lookupPaso0GlossaryDefinition(candidate, termSources);
      if (!definition) continue;
      expanded.push(candidate);
      return line.replace(GLOSSARY_PLACEHOLDER_RE, definition);
    }
    return line;
  });
  return { body: out.join("\n"), expanded: [...new Set(expanded)] };
}

/** Expande glosario §1 en el MDD completo (stream + persist). */
export function expandGlossaryFromPaso0Catalog(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): { markdown: string; expanded: string[] } {
  const section1 = extractSectionByNumber(mddMarkdown, 1);
  if (!section1) return { markdown: mddMarkdown, expanded: [] };
  const body = section1.replace(/^##[^\n]+\n?/, "").trim();
  const glossary = expandPaso0GlossaryPlaceholdersInSection1(body, catalog);
  if (glossary.expanded.length === 0 && glossary.body === body) {
    return { markdown: mddMarkdown, expanded: [] };
  }
  return {
    markdown: replaceSectionBody(mddMarkdown, 1, glossary.body),
    expanded: glossary.expanded,
  };
}

const SECTION4_PIPELINE_PLACEHOLDER_RE =
  /\(?\s*Pendiente:\s*paso dedicado\s+L[oó]gica\s+y\s+Edge\s+Cases\s*\)?/gi;

/** Elimina bloques OAuth huérfanos (refreshToken/accessToken) sin heading ### en §4 (D-003). */
export function stripOrphanOAuthCallbackBlocksFromSection4(section4Body: string): string {
  const headerRe = /\n(?=###\s+(?:GET|POST|PUT|PATCH|DELETE)\s+)/g;
  const parts = (section4Body ?? "").split(headerRe);
  const kept: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (/^###\s+(?:GET|POST|PUT|PATCH|DELETE)\s+/i.test(trimmed)) {
      const cleaned = stripTrailingOrphanOAuthFromRouteBlock(part);
      kept.push(cleaned.startsWith("\n") ? cleaned : `\n${cleaned}`);
      continue;
    }
    if (/refreshToken|accessToken|authorization_code|INVALID_AUTHORIZATION_CODE/i.test(trimmed)) {
      continue;
    }
    kept.push(part);
  }
  return kept.join("").trim().replace(/\n{3,}/g, "\n\n");
}

/** Quita apéndice OAuth tras `---` al final de un bloque ### ruta (callback pegado al endpoint anterior). */
function stripTrailingOrphanOAuthFromRouteBlock(block: string): string {
  const orphanRe =
    /\n---\n[\s\S]*?(?:refreshToken|accessToken|authorization_code|INVALID_AUTHORIZATION_CODE)[\s\S]*$/i;
  return block.replace(orphanRe, "").trimEnd();
}

function normalizePaso0ApiPathParams(path: string): string {
  return (path ?? "")
    .replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_m, name: string) => `:${name.replace(/Id$/i, "Id")}`)
    .replace(/:contextId\b/gi, ":id")
    .replace(/:appId\b/gi, ":id")
    .replace(/:attachmentId\b/gi, ":id")
    .replace(/:messageId\b/gi, ":id")
    .replace(/:topicId\b/gi, ":id");
}

/** Clave de dedupe §4: método + ruta con params normalizados a :id. */
function section4RouteDedupeKey(method: string, path: string): string {
  const normalized = normalizePaso0ApiPathParams(path)
    .replace(/:[a-zA-Z_][a-zA-Z0-9_]*Id\b/gi, ":id")
    .toLowerCase();
  return `${method}|${normalized}`;
}

function normalizeSection4ApiPathSyntax(body: string): string {
  return (body ?? "")
    .split(/\r?\n/)
    .map((line) => {
      if (/^#{2,4}\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+/i.test(line)) {
        return line.replace(
          /(\b(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+)([^\s`]+)/i,
          (_full, method: string, path: string) => `${method}${normalizePaso0ApiPathParams(path)}`,
        );
      }
      if (!line.trim().startsWith("|")) return line;
      return line.replace(/`([^`]+)`|(\/(?:api\/v1\/)?[a-z0-9/_:-{}]+)/gi, (m) =>
        m.startsWith("`")
          ? `\`${normalizePaso0ApiPathParams(m.slice(1, -1))}\``
          : normalizePaso0ApiPathParams(m),
      );
    })
    .join("\n");
}

function dedupeSection4TableRows(body: string): string {
  const seen = new Set<string>();
  return (body ?? "")
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim().startsWith("|") || !/\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/i.test(line)) {
        return line;
      }
      const pathMatch = line.match(/`([^`]+)`|(\/(?:api\/v1\/)?[a-z0-9/_:-]+)/i);
      const path = normalizePaso0ApiPathParams(
        (pathMatch?.[1] ?? pathMatch?.[2] ?? "").replace(/`/g, ""),
      );
      const method = line.match(/\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/i)?.[1]?.toUpperCase() ?? "";
      const key = section4RouteDedupeKey(method, path);
      if (!path || !method) return line;
      if (seen.has(key)) return "";
      seen.add(key);
      return line.replace(/`([^`]+)`|(\/(?:api\/v1\/)?[a-z0-9/_:-]+)/gi, (m) =>
        m.startsWith("`") ? `\`${normalizePaso0ApiPathParams(m.slice(1, -1))}\`` : normalizePaso0ApiPathParams(m),
      );
    })
    .filter(Boolean)
    .join("\n");
}

/** Reparación determinista §4: JSON corrupto, placeholders, rutas duplicadas y alias de path. */
export function repairPaso0Section4Content(section4Body: string): {
  body: string;
  fixed: string[];
} {
  const fixed: string[] = [];
  let body = (section4Body ?? "").trim();
  if (!body) return { body, fixed };

  if (SECTION4_PIPELINE_PLACEHOLDER_RE.test(body)) {
    body = body.replace(SECTION4_PIPELINE_PLACEHOLDER_RE, "").trim();
    fixed.push("§4-placeholder-removed");
  }

  const artifactsBefore = body;
  body = repairContratosMarkdownArtifacts(body);
  if (body !== artifactsBefore) fixed.push("§4-markdown-artifacts");

  const stubStrip = stripContractStubJsonBlocks(body);
  if (stubStrip.stripped > 0) {
    body = stubStrip.body;
    fixed.push("§4-json-stub-stripped");
  }

  const normalizedPaths = normalizeSection4ApiPathSyntax(body);
  if (normalizedPaths !== body) {
    body = normalizedPaths;
    fixed.push("§4-path-params");
  }

  const jsonSanitize = sanitizeSection4JsonBlocksForDelivery(body);
  if (jsonSanitize.fixed.length > 0) {
    body = jsonSanitize.body;
    fixed.push(...jsonSanitize.fixed);
  }

  const deduped = dedupeSection4TableRows(body);
  if (deduped !== body) {
    body = deduped;
    fixed.push("§4-dedupe-routes");
  }

  return { body: body.replace(/\n{3,}/g, "\n\n").trim(), fixed };
}

/** Detecta JSON §4 corrupto no parseable tras reparación determinista. */
export function detectPaso0Section4JsonCorruption(section4: string): string[] {
  const blockers: string[] = [];
  const { body: repairedBody } = sanitizeSection4JsonBlocksForDelivery(section4 ?? "");
  const body = repairedBody;
  const corruptPatterns = [
    /"data"\s*:\s*\[\s*\]\s*,\s*\{/,
    /"errors"\s*:\s*\[\s*,/,
    /```json[\s\S]*?\[\s*,/i,
  ];
  if (corruptPatterns.some((re) => re.test(body))) {
    blockers.push(
      "[Paso 0 §4] JSON corrupto en contratos (arrays vacíos pegados u objetos huérfanos) — reparar §4 antes de persistir.",
    );
  }
  for (const block of body.match(/```json\s*\n([\s\S]*?)```/gi) ?? []) {
    const inner = block.replace(/^```json\s*\n/i, "").replace(/\n```$/i, "").trim();
    if (!inner) continue;
    try {
      JSON.parse(repairGluedEmptyJsonArrays(inner));
    } catch {
      blockers.push(
        "[Paso 0 §4] Bloque ```json inválido en contratos — reparar request/response antes de persistir.",
      );
      break;
    }
  }
  return blockers;
}

/** Corrige filas de tabla con prefijo `# |` (p. ej. `# | **Auditoría…` o `# | EC-22 |`). */
export function sanitizeHashPipeTableRowCorruption(body: string): string {
  return (body ?? "")
    .replace(/^\s*#\s*\|\s*(?=\*\*|[A-Za-zÁÉÍÓÚáéíóú0-9])/gim, "| ")
    .replace(/^\|\s*#\s*\|\s*(?=\*\*|[A-Za-zÁÉÍÓÚáéíóú0-9])/gim, "| ")
    .replace(/^\s*#\s*\|\s*(EC-\d+)/gim, "| $1")
    .replace(/^\|\s*#\s*\|\s*(EC-\d+)/gim, "| $1")
    .replace(/^\s*#\s*\|\s*\|/gim, "|")
    .replace(/^\|\s*#\s*\|\s*\|/gim, "|")
    .replace(/^\s*#\s*\|\s*#/gim, "|");
}

/** Corrige filas EC-XX comentadas como `# | EC-22 |` o `| # | EC-22 |` en tablas §5.2. */
export function sanitizeSection5EdgeCaseTableRows(body: string): string {
  return sanitizeHashPipeTableRowCorruption(body);
}

/** Inyecta filas EC-05…EC-22 ausentes en §5.2 (EXPECTED-MDD). */
export function injectMissingPaso0EdgeCasesIntoSection5(
  mddMarkdown: string,
  _catalog?: Paso0DecisionCatalog,
): { markdown: string; injected: string[] } {
  const section5 = extractSectionByNumber(mddMarkdown, 5);
  if (!section5) return { markdown: mddMarkdown, injected: [] };

  let body = section5.replace(/^##[^\n]+\n?/, "").trim();
  body = sanitizeSection5EdgeCaseTableRows(body);
  const missing = WORKSPACE_CHAT_EDGE_CASES.filter((ec) => !new RegExp(`\\b${ec.id}\\b`).test(body));
  if (missing.length === 0) return { markdown: mddMarkdown, injected: [] };

  const rows = missing.map(
    (ec) => `| ${ec.id} | ${ec.case} | ${ec.treatment} | ${ec.decisionIds} |`,
  );
  const block =
    `\n\n### Edge cases Paso 0 (auto)\n\n` +
    `| # | Caso | Tratamiento | D-ID |\n` +
    `|:--:|---|---|---|\n` +
    rows.join("\n") +
    `\n`;

  return {
    markdown: replaceSectionBody(mddMarkdown, 5, body.trimEnd() + block),
    injected: missing.map((ec) => ec.id),
  };
}

/** Detecta patrones offline/PWA/Service Worker en §2 cuando D-088 exige cliente online-only. */
export function detectPaso0OfflinePatterns(
  mddMarkdown: string,
  catalog?: Paso0DecisionCatalog | null,
): string[] {
  if (catalog && !catalogRequiresMobileOnlineOnly(catalog)) return [];
  const section2 = extractSectionByNumber(mddMarkdown, 2) ?? "";
  if (!section2.trim()) return [];
  const hits: string[] = [];
  for (const re of PASO0_OFFLINE_FIRST_PATTERNS) {
    const m = section2.match(re);
    if (m?.[0]) hits.push(m[0].slice(0, 80));
  }
  if (hits.length === 0) return [];
  return [
    `[Paso 0] Patrones offline-first/PWA/cola local en §2 incompatibles con D-088 (cliente móvil solo en línea): ${[...new Set(hits)].slice(0, 4).join("; ")}`,
  ];
}

/** Elimina bullets §2 con vocabulario offline-first cuando aplica D-088. */
export function sanitizePaso0OfflinePatternsInSection2(
  section2Body: string,
  catalog: Paso0DecisionCatalog,
): { body: string; warnings: string[] } {
  if (!catalogRequiresMobileOnlineOnly(catalog)) {
    return { body: section2Body, warnings: [] };
  }
  const warnings: string[] = [];
  const lines = (section2Body ?? "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (PASO0_OFFLINE_FIRST_PATTERNS.some((re) => re.test(line))) {
      warnings.push(`§2: patrón offline-first eliminado — ${line.slice(0, 80)}`);
      continue;
    }
    out.push(line);
  }
  return { body: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), warnings };
}

function buildPaso0ForbiddenEntitySet(catalog?: Paso0DecisionCatalog | null): Set<string> {
  const skip = new Set<string>();
  for (const table of PASO0_FORBIDDEN_ENTITY_TABLES) skip.add(table.toLowerCase());
  for (const table of PASO0_INVENTED_PLATFORM_TABLES) skip.add(table.toLowerCase());
  if (catalog && catalogRequiresSsoIntegral(catalog)) {
    skip.add("refresh_tokens");
    skip.add("security_events");
  }
  return skip;
}

/** Blockers duros del delivery gate cuando hay catálogo Paso 0 pegado. */
export function collectPaso0DeliveryGateBlockers(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): string[] {
  const blockers: string[] = [];
  const section3 = extractSectionByNumber(mddMarkdown, 3) ?? "";
  const tablesToStrip = listPaso0TablesToStripFromSection3(catalog);
  for (const table of tablesToStrip) {
    const createRe = new RegExp(
      `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${paso0CreateTableEntityPattern(table)}\\s*\\(`,
      "i",
    );
    if (createRe.test(section3)) {
      blockers.push(
        `[Paso 0 §3] CREATE TABLE prohibida/inventada \`${table}\` — alinear con catálogo D-ID.`,
      );
    }
  }

  blockers.push(...detectPaso0CorruptedSection3Sql(section3));
  blockers.push(...detectPaso0Section3SqlSyntaxErrors(section3));

  const forbiddenSegments = listPaso0ForbiddenApiRouteSegmentsForCatalog(catalog);
  const forbiddenMatchOpts = paso0ForbiddenRouteMatchOptions(catalog);
  const forbiddenEntities = buildPaso0ForbiddenEntitySet(catalog);
  const section4 = extractSectionByNumber(mddMarkdown, 4) ?? "";
  for (const line of section4.split("\n")) {
    for (const path of extractApiPathsFromSection4Line(line)) {
      if (apiPathMatchesPaso0ForbiddenSegment(path, forbiddenSegments, forbiddenMatchOpts)) {
        blockers.push(`[Paso 0 §4] Ruta API prohibida: ${path}`);
      }
    }
    if (!line.trim().startsWith("|") && !extractApiPathsFromSection4Line(line).length) continue;
    if (/\(coherence auto\)/i.test(line)) {
      const pathMatch = line.match(/`([^`]+)`|(\/[a-z0-9/_:-]+)/i);
      const path = (pathMatch?.[1] ?? pathMatch?.[2] ?? "").replace(/`/g, "");
      if (path && apiPathMatchesPaso0ForbiddenSegment(path, forbiddenSegments, forbiddenMatchOpts)) {
        blockers.push(`[Paso 0 §4] Endpoint (coherence auto) con ruta prohibida: ${path}`);
        continue;
      }
      const slugFromPath = path
        .match(/\/api\/v1\/([^/`{]+)/i)?.[1]
        ?.replace(/-/g, "_")
        .toLowerCase();
      if (slugFromPath && forbiddenEntities.has(slugFromPath)) {
        blockers.push(
          `[Paso 0 §4] Endpoint (coherence auto) prohibido para entidad \`${slugFromPath}\`.`,
        );
        continue;
      }
      for (const entity of forbiddenEntities) {
        if (new RegExp(`\\b${entity.replace(/_/g, "[_\\s-]*")}\\b`, "i").test(line)) {
          blockers.push(
            `[Paso 0 §4] Endpoint (coherence auto) prohibido para entidad \`${entity}\`.`,
          );
          break;
        }
      }
    }
  }

  blockers.push(...detectPaso0OfflinePatterns(mddMarkdown, catalog));

  if (catalogMarksStranglerOutOfScope(catalog)) {
    const section2 = extractSectionByNumber(mddMarkdown, 2) ?? "";
    const section6 = extractSectionByNumber(mddMarkdown, 6) ?? "";
    const section7 = extractSectionByNumber(mddMarkdown, 7) ?? "";
    if (STRANGLER_FIG_RE.test(section2)) {
      blockers.push(
        "[Paso 0 §2] Strangler Fig documentado — incompatible con D-121 (corte por campaña, sin convivencia operativa permanente).",
      );
    }
    if (STRANGLER_FIG_RE.test(section6)) {
      blockers.push(
        "[Paso 0 §6] Strangler Fig documentado — incompatible con D-121 (corte por campaña, sin convivencia operativa permanente).",
      );
    }
    if (STRANGLER_FIG_RE.test(section7)) {
      blockers.push(
        "[Paso 0 §7] Strangler Fig documentado — incompatible con D-121 (corte por campaña, sin convivencia operativa permanente).",
      );
    }
  }

  const section4ForJson = extractSectionByNumber(mddMarkdown, 4) ?? "";
  blockers.push(...detectPaso0Section4JsonCorruption(section4ForJson));

  blockers.push(...detectPaso0LocalAuthPatterns(mddMarkdown, catalog));

  const missingCanonical = collectMissingPaso0CanonicalTables(mddMarkdown, catalog);
  for (const table of missingCanonical.slice(0, 20)) {
    blockers.push(
      `[Paso 0 §3] Entidad canónica obligatoria ausente: CREATE TABLE \`${table}\` — requerida por catálogo Paso 0.`,
    );
  }

  const section4ForRoutes = extractSectionByNumber(mddMarkdown, 4) ?? "";
  for (const family of listPaso0MandatoryRouteFamilies(catalog).filter((f) => f.critical)) {
    if (!section4HasRouteFamily(section4ForRoutes, family)) {
      blockers.push(
        `[Paso 0 §4] Familia de rutas MVP crítica ausente: ${family.label} (${family.pathPatterns.join(", ")}) — ${family.decisionIds?.join(", ") ?? "MVP"}.`,
      );
    }
  }

  blockers.push(...detectMissingPaso0Section9Blocker(mddMarkdown, catalog));
  blockers.push(...detectPaso0Section6PlaceholderBlocker(mddMarkdown, catalog));

  const alignment = scorePaso0ExpectedAlignment(catalog, mddMarkdown);
  if (alignment.score < 70 && (missingCanonical.length > 0 || alignment.missingCriticalRoutes.length > 0)) {
    blockers.push(
      `[Paso 0] Alineación EXPECTED insuficiente (${alignment.score}/100): faltan ${missingCanonical.length} tablas y ${alignment.missingCriticalRoutes.length} familias de rutas críticas.`,
    );
  }

  return [...new Set(blockers)];
}

export function detectPaso0RetentionDeviations(mddMarkdown: string): string[] {
  const sections = [1, 5, 6]
    .map((n) => extractSectionByNumber(mddMarkdown, n) ?? "")
    .join("\n");
  if (!/\bretenci[oó]n\b/i.test(sections)) return [];

  const hasCanonical = PASO0_CANONICAL_RETENTION_MARKERS.some((m) =>
    sections.toLowerCase().includes(m.toLowerCase()),
  );
  if (hasCanonical) return [];

  const suspicious = sections.match(
    /\b(?:retenci[oó]n|retention)[^\n.]{0,80}\b(\d+\s*(?:d[ií]as?|meses?|a[nñ]os?|years?))\b/gi,
  );
  if (!suspicious?.length) return [];

  return [
    `[Paso 0] Valores de retención posiblemente no alineados con D-098 (esperado: 3 meses visible, 6 meses operativa, 2 años auditoría, hold +30 días). Detectado: ${suspicious.slice(0, 3).join("; ")}`,
  ];
}

function replaceSectionBody(
  draft: string,
  sectionNum: number,
  newBody: string,
): string {
  const section = extractSectionByNumber(draft, sectionNum);
  if (!section) return draft;
  const heading = section.match(/^##[^\n]+/)?.[0] ?? "";
  const rebuilt = `${heading}\n\n${newBody.trim()}\n`;
  return draft.replace(section, rebuilt);
}

/**
 * Aplica enforcement determinista post-gen cuando hay catálogo Paso 0.
 * Idempotente: puede invocarse más de una vez en el pipeline SSOT.
 */
export function enforcePaso0CatalogOnMdd(
  mddMarkdown: string,
  catalog: Paso0DecisionCatalog,
): Paso0MddEnforcementResult {
  const draft = (mddMarkdown ?? "").trim();
  if (!draft) {
    return {
      markdown: draft,
      strippedTables: [],
      missingCanonical: [],
      section1Warnings: [],
      section2Warnings: [],
      section4StrippedRoutes: [],
      paso0RoutesInjected: [],
      retentionWarnings: [],
      localAuthWarnings: [],
      gaps: [],
    };
  }

  let markdown = stripClarifierAgentBriefFromSection1(draft);
  markdown = repairSection3SqlInMdd(markdown);
  const glossaryExpand = expandGlossaryFromPaso0Catalog(markdown, catalog);
  if (glossaryExpand.expanded.length > 0) {
    markdown = glossaryExpand.markdown;
  }
  let paso0RoutesInjected: string[] = [];
  let section1Warnings: string[] = [];
  let section2Warnings: string[] = [];
  const tablesToStrip = listPaso0TablesToStripFromSection3(catalog);
  const strippedTables: string[] = [];

  const section3 = extractSectionByNumber(markdown, 3);
  if (section3) {
    let newSection3 = section3;
    if (/```sql\n/i.test(section3)) {
      const sqlStripped = stripAllSection3SqlFences(section3, tablesToStrip);
      strippedTables.push(...sqlStripped.stripped);
      newSection3 = sqlStripped.section3;
    }
    newSection3 = stripPaso0TablesFromErDiagrams(newSection3, tablesToStrip);
    newSection3 = sanitizePaso0ErDiagramInSection3(newSection3, catalog);
    const body3 = newSection3.replace(/^##[^\n]+\n?/, "").trim();
    const dualApproval = sanitizePaso0DualApprovalInSection3(body3, catalog);
    if (dualApproval.warnings.length > 0) {
      const heading = newSection3.match(/^##[^\n]+/)?.[0] ?? "";
      newSection3 = `${heading}\n\n${dualApproval.body.trim()}\n`;
      section2Warnings = [...section2Warnings, ...dualApproval.warnings];
    }
    if (newSection3 !== section3) markdown = markdown.replace(section3, newSection3);
  }

  const section1 = extractSectionByNumber(markdown, 1);
  if (section1) {
    let body = section1.replace(/^##[^\n]+\n?/, "").trim();
    const sanitized = sanitizePaso0ForbiddenEntitiesInSection1(body);
    body = sanitized.body;
    section1Warnings = sanitized.warnings;
    const dbgaStrip = stripPaso0DbgaLeakFromSection1(body, catalog);
    if (dbgaStrip.warnings.length > 0) {
      body = dbgaStrip.body;
      section1Warnings = [...section1Warnings, ...dbgaStrip.warnings];
    }
    const glossary = expandPaso0GlossaryPlaceholdersInSection1(body, catalog);
    if (glossary.expanded.length > 0) {
      body = glossary.body;
      section1Warnings.push(
        ...glossary.expanded.map((t) => `§1: glosario expandido — ${t}`),
      );
    }
    const mvpAlign = sanitizePaso0Section1MvpAlignment(body, catalog);
    if (mvpAlign.warnings.length > 0) {
      body = mvpAlign.body;
      section1Warnings = [...section1Warnings, ...mvpAlign.warnings];
    }
    if (
      isWorkspaceChatPaso0Catalog(catalog) &&
      !PASO0_CANONICAL_RETENTION_MARKERS.some((m) => body.toLowerCase().includes(m.toLowerCase()))
    ) {
      body = `${body.trimEnd()}\n\n- **Política de retención:** ${WORKSPACE_CHAT_RETENTION_GLOSSARY_TEXT}\n`;
      section1Warnings.push("§1: política de retención D-098 inyectada");
    }
    if (body !== section1.replace(/^##[^\n]+\n?/, "").trim() || section1Warnings.length > 0) {
      markdown = replaceSectionBody(markdown, 1, body);
    }
  }

  const section2 = extractSectionByNumber(markdown, 2);
  if (section2) {
    let body = section2.replace(/^##[^\n]+\n?/, "").trim();
    body = sanitizeHashPipeTableRowCorruption(body);
    const offline = sanitizePaso0OfflinePatternsInSection2(body, catalog);
    body = offline.body;
    section2Warnings = offline.warnings;
    const strangler = sanitizePaso0StranglerPatternsInSection2(body, catalog);
    if (strangler.warnings.length > 0) {
      body = strangler.body;
      section2Warnings = [...section2Warnings, ...strangler.warnings];
    }
    const stackFraming = ensurePaso0Section2StackProposalFraming(body, catalog);
    if (stackFraming.warnings.length > 0) {
      body = stackFraming.body;
      section2Warnings = [...section2Warnings, ...stackFraming.warnings];
    }
    const sloStrip = sanitizePaso0InventedSlosInSection2(body, catalog);
    if (sloStrip.warnings.length > 0) {
      body = sloStrip.body;
      section2Warnings = [...section2Warnings, ...sloStrip.warnings];
    }
    if (body !== section2.replace(/^##[^\n]+\n?/, "").trim() || section2Warnings.length > 0) {
      markdown = replaceSectionBody(markdown, 2, body);
    }
  }

  const governanceStrangler = sanitizePaso0StranglerInGovernanceSection(markdown, catalog);
  if (governanceStrangler.warnings.length > 0) {
    markdown = governanceStrangler.markdown;
    section2Warnings.push(...governanceStrangler.warnings);
  }

  let section4StrippedRoutes: string[] = [];
  const section4 = extractSectionByNumber(markdown, 4);
  if (section4) {
    let body = section4.replace(/^##[^\n]+\n?/, "").trim();
    body = stripOrphanOAuthCallbackBlocksFromSection4(body);
    const ingestNorm = normalizePaso0IngestEventsRouteAliases(body);
    if (ingestNorm.normalized.length > 0) {
      body = ingestNorm.body;
    }
    const breakGlassNorm = normalizePaso0BreakGlassRouteAliases(body);
    if (breakGlassNorm.normalized.length > 0) {
      body = breakGlassNorm.body;
    }
    const breakGlassSingle = normalizePaso0BreakGlassSingleApproverInSection4(body);
    if (breakGlassSingle.normalized.length > 0) {
      body = breakGlassSingle.body;
    }
    const dualProse4 = sanitizePaso0DualApprovalProseInBody(body, catalog, "§4");
    if (dualProse4.warnings.length > 0) {
      body = dualProse4.body;
      section4StrippedRoutes.push("dual-approval-prose");
    }
    const coherenceStrip = stripPaso0ForbiddenCoherenceAutoRoutesFromSection4(body, catalog);
    if (coherenceStrip.stripped.length > 0) {
      body = coherenceStrip.body;
      section4StrippedRoutes.push(...coherenceStrip.stripped);
    }
    const sanitized = stripPaso0ForbiddenApiRoutesFromSection4(body, catalog);
    if (sanitized.strippedRoutes.length > 0) {
      section4StrippedRoutes = [...section4StrippedRoutes, ...sanitized.strippedRoutes];
      body = sanitized.body;
    }
    const section4Repair = repairPaso0Section4Content(body);
    if (section4Repair.fixed.length > 0) {
      body = section4Repair.body;
    }
    if (
      body !== section4.replace(/^##[^\n]+\n?/, "").trim() ||
      section4StrippedRoutes.length > 0 ||
      section4Repair.fixed.length > 0 ||
      ingestNorm.normalized.length > 0 ||
      breakGlassNorm.normalized.length > 0 ||
      breakGlassSingle.normalized.length > 0
    ) {
      markdown = replaceSectionBody(markdown, 4, body);
    }

    const routeInjection = injectMissingPaso0MandatoryRoutesIntoSection4(markdown, catalog);
    if (routeInjection.injected.length > 0) {
      markdown = routeInjection.markdown;
      paso0RoutesInjected = routeInjection.injected;
    }
  }

  const section5 = extractSectionByNumber(markdown, 5);
  if (section5) {
    let body5 = section5.replace(/^##[^\n]+\n?/, "").trim();
    const sanitized5 = sanitizeSection5EdgeCaseTableRows(body5);
    if (sanitized5 !== body5) {
      markdown = replaceSectionBody(markdown, 5, sanitized5);
    }
    const ecInjection = injectMissingPaso0EdgeCasesIntoSection5(markdown, catalog);
    if (ecInjection.injected.length > 0) {
      markdown = ecInjection.markdown;
    }
  }

  const section7 = extractSectionByNumber(markdown, 7);
  if (section7) {
    let body7 = section7.replace(/^##[^\n]+\n?/, "").trim();
    const strangler7 = sanitizePaso0StranglerPatternsInBody(body7, catalog, "§7");
    if (strangler7.warnings.length > 0) {
      body7 = strangler7.body;
      section2Warnings = [...section2Warnings, ...strangler7.warnings];
    }
    const sso7 = sanitizePaso0SsoContradictionsInSection6(body7, catalog);
    if (sso7.warnings.length > 0) {
      body7 = sso7.body;
      section2Warnings = [...section2Warnings, ...sso7.warnings.map((w) => `§7: ${w}`)];
    }
    const slo7 = sanitizePaso0InventedSlosInSection7(body7, catalog);
    if (slo7.warnings.length > 0) {
      body7 = slo7.body;
      section2Warnings = [...section2Warnings, ...slo7.warnings];
    }
    const dualProse7 = sanitizePaso0DualApprovalProseInBody(body7, catalog, "§7");
    if (dualProse7.warnings.length > 0) {
      body7 = dualProse7.body;
      section2Warnings = [...section2Warnings, ...dualProse7.warnings];
    }
    if (
      body7 !== section7.replace(/^##[^\n]+\n?/, "").trim() ||
      strangler7.warnings.length > 0 ||
      sso7.warnings.length > 0 ||
      slo7.warnings.length > 0 ||
      dualProse7.warnings.length > 0
    ) {
      markdown = replaceSectionBody(markdown, 7, body7);
    }
  }

  const section6 = extractSectionByNumber(markdown, 6);
  if (section6) {
    const body = section6.replace(/^##[^\n]+\n?/, "").trim();
    const ssoSanitized = sanitizePaso0SsoContradictionsInSection6(body, catalog);
    let body6 = ssoSanitized.body;
    const strangler6 = sanitizePaso0StranglerPatternsInBody(body6, catalog, "§6");
    if (strangler6.warnings.length > 0) {
      body6 = strangler6.body;
      section2Warnings = [...section2Warnings, ...strangler6.warnings];
    }
    const breakGlass6 = normalizePaso0BreakGlassSingleApproverInSection6(body6);
    if (breakGlass6.warnings.length > 0) {
      body6 = breakGlass6.body;
      section2Warnings = [...section2Warnings, ...breakGlass6.warnings];
    }
    const securityEvents = sanitizePaso0SecurityEventsReferencesInSection6(body6, markdown, catalog);
    if (securityEvents.warnings.length > 0) {
      body6 = securityEvents.body;
      section2Warnings = [...section2Warnings, ...securityEvents.warnings];
    }
    if (
      body6 !== section6.replace(/^##[^\n]+\n?/, "").trim() ||
      ssoSanitized.warnings.length > 0 ||
      breakGlass6.warnings.length > 0 ||
      securityEvents.warnings.length > 0
    ) {
      markdown = replaceSectionBody(markdown, 6, body6);
    }
  }

  const stranglerMdd = sanitizePaso0StranglerFigInMdd(markdown, catalog);
  if (stranglerMdd.warnings.length > 0) {
    markdown = stranglerMdd.markdown;
    section2Warnings = [...section2Warnings, ...stranglerMdd.warnings];
  }

  const ssoMdd = sanitizePaso0SsoContradictionsInMdd(markdown, catalog);
  if (ssoMdd.markdown !== markdown) {
    markdown = ssoMdd.markdown;
  }

  const mfaTotp = sanitizePaso0MfaTotpInMdd(markdown, catalog);
  if (mfaTotp.markdown !== markdown) {
    markdown = mfaTotp.markdown;
  }
  if (mfaTotp.warnings.length > 0) {
    section2Warnings = [...section2Warnings, ...mfaTotp.warnings.slice(0, 4)];
  }

  const stubRepair = shouldReplaceSection3WithPaso0Canonical(markdown, catalog)
    ? (() => {
        let next = replaceSection3SqlWithPaso0CanonicalStubs(markdown, catalog);
        next = repairSection3SqlInMdd(next);
        const erRegen = regenerateAndSanitizePaso0Section3ErDiagram(next, catalog);
        if (erRegen.applied) next = erRegen.markdown;
        next = paso0Section3AfterErRegen(next, catalog);
        section2Warnings.push("§3: reemplazo canónico determinista (SQL corrupto/duplicado)");
        return { markdown: next, injected: [] as string[] };
      })()
    : injectMissingPaso0CanonicalStubsIntoMdd(markdown, catalog);
  if (stubRepair.injected.length > 0 || stubRepair.markdown !== markdown) {
    markdown = stubRepair.markdown;
    markdown = repairSection3SqlInMdd(markdown);
    markdown = paso0Section3AfterErRegen(markdown, catalog);
  }

  const tailEnrichment = applyPaso0TailSectionEnrichment(markdown, catalog);
  if (tailEnrichment.applied.length > 0) {
    markdown = tailEnrichment.markdown;
  }

  const governanceStranglerDeselect = sanitizePaso0StranglerInGovernanceSection(markdown, catalog);
  if (governanceStranglerDeselect.warnings.length > 0) {
    markdown = governanceStranglerDeselect.markdown;
    section2Warnings = [...section2Warnings, ...governanceStranglerDeselect.warnings];
  }

  const tailDedupe = deduplicatePaso0TailSections(markdown);
  if (tailDedupe.removed.length > 0) {
    markdown = tailDedupe.markdown;
    section2Warnings.push(`tail-dedupe: ${tailDedupe.removed.join(",")}`);
  }

  const finalStranglerDeselect = sanitizePaso0StranglerInGovernanceSection(markdown, catalog);
  if (finalStranglerDeselect.warnings.length > 0) {
    markdown = finalStranglerDeselect.markdown;
    section2Warnings = [...section2Warnings, ...finalStranglerDeselect.warnings];
  }

  const missingCanonical = collectMissingPaso0CanonicalTables(markdown, catalog);
  const retentionWarnings = detectPaso0RetentionDeviations(markdown);
  const localAuthWarnings = detectPaso0LocalAuthPatterns(markdown, catalog);

  const gaps: string[] = [];
  if (strippedTables.length > 0) {
    gaps.push(
      `[Paso 0 §3] Tablas prohibidas/inventadas eliminadas: ${[...new Set(strippedTables)].join(", ")}`,
    );
  }
  if (missingCanonical.length > 0) {
    gaps.push(
      `[Paso 0 §3] Entidades canónicas ausentes (${missingCanonical.length}): ${missingCanonical.slice(0, 12).join(", ")}${missingCanonical.length > 12 ? "…" : ""}`,
    );
  }
  for (const w of section1Warnings.slice(0, 4)) gaps.push(`[Paso 0 §1] ${w}`);
  for (const w of section2Warnings.slice(0, 4)) gaps.push(`[Paso 0 §2] ${w}`);
  if (section4StrippedRoutes.length > 0) {
    gaps.push(
      `[Paso 0 §4] Rutas prohibidas eliminadas: ${section4StrippedRoutes.slice(0, 6).join(", ")}`,
    );
  }
  if (paso0RoutesInjected.length > 0) {
    gaps.push(
      `[Paso 0 §4] Rutas MVP críticas inyectadas (${paso0RoutesInjected.length}): ${paso0RoutesInjected.join(", ")}`,
    );
  }
  gaps.push(...retentionWarnings, ...localAuthWarnings);

  return {
    markdown,
    strippedTables: [...new Set(strippedTables)],
    missingCanonical,
    section1Warnings,
    section2Warnings,
    section4StrippedRoutes,
    paso0RoutesInjected,
    retentionWarnings,
    localAuthWarnings,
    gaps,
  };
}
