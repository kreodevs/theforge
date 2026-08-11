/**
 * Detección y extracción determinística de Paso 0 definitivo pegado (D-IDs).
 * Sin LLM — solo parseo estructural del markdown STEP_0-like.
 */

import { createHash } from "node:crypto";
import {
  PASO0_DECISION_CATALOG_KIND,
  paso0DecisionCatalogSchema,
  parsePaso0DecisionCatalog,
  type Paso0DecisionCatalog,
  type Paso0DecisionItem,
  type Paso0EntityTerm,
  type Paso0MvpCapability,
  type Paso0OutOfScopeItem,
  type Paso0RiskItem,
  extractDecisionIds,
  enrichPaso0DecisionCatalog,
  isPaso0PasteSidecarJson,
  type BrdCapability,
} from "@theforge/shared-types";
import { isDeepResearchMarkdown } from "./phase0-template-detect.util.js";

export const MIN_PASTED_DEFINITIVE_PASO0_CHARS = 4_000;
export const MIN_PASTED_DEFINITIVE_D_ID_COUNT = 15;
export const MIN_PASTED_DEFINITIVE_H2_SECTIONS = 8;

const D_ID_COUNT_RE = /\bD-\d{3}\b/g;
const H2_NUMBERED_RE = /^##\s+\d+\./gm;

const GOVERNANCE_SECTION_RE =
  /Reglas de lectura y gobierno|Tipos de afirmación|Decisión confirmada|Matriz consolidada de alcance/i;

const CONFIRMED_DECISION_TYPE = /decisi[oó]n confirmada/i;

export type Paso0DecisionCatalogExtract = Paso0DecisionCatalog;

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function countDIds(md: string): number {
  return (md.match(D_ID_COUNT_RE) ?? []).length;
}

function countNumberedH2Sections(md: string): number {
  return (md.match(H2_NUMBERED_RE) ?? []).length;
}

/**
 * TRUE cuando el markdown pegado es un Paso 0 definitivo consolidado (STEP_0-like).
 */
export function isPastedDefinitivePaso0(md: string | null | undefined): boolean {
  const text = md?.trim() ?? "";
  if (text.length < MIN_PASTED_DEFINITIVE_PASO0_CHARS) return false;
  if (countDIds(text) < MIN_PASTED_DEFINITIVE_D_ID_COUNT) return false;
  if (!CONFIRMED_DECISION_TYPE.test(text) && !/Matriz consolidada de alcance/i.test(text)) {
    return false;
  }
  if (countNumberedH2Sections(text) < MIN_PASTED_DEFINITIVE_H2_SECTIONS) return false;
  if (isDeepResearchMarkdown(text)) return false;
  if (!GOVERNANCE_SECTION_RE.test(text)) return false;
  return true;
}

function parseTableCells(line: string): string[] {
  const t = line.trim();
  if (!t.startsWith("|")) return [];
  return t
    .split("|")
    .slice(1, -1)
    .map((c) => c.replace(/\*\*/g, "").trim());
}

function isTableSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, "")));
}

function parseMarkdownTable(tableBlock: string): { headers: string[]; rows: string[][] } {
  const lines = tableBlock.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
  if (lines.length === 0) return { headers: [], rows: [] };

  const headerCells = parseTableCells(lines[0] ?? "");
  const headers = headerCells.map((h) => h.toLowerCase());
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseTableCells(lines[i] ?? "");
    if (cells.length === 0 || isTableSeparatorRow(cells)) continue;
    if (/^ID\s*\|\s*Riesgo/i.test(lines[i] ?? "")) continue;
    rows.push(cells);
  }

  return { headers, rows };
}

function findColumnIndex(headers: string[], ...candidates: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] ?? "";
    if (candidates.some((re) => re.test(h))) return i;
  }
  return -1;
}

function extractSubsection(markdown: string, headingRe: RegExp): string {
  const flags = headingRe.flags.includes("m") ? headingRe.flags : `${headingRe.flags}m`;
  const re = new RegExp(headingRe.source, flags);
  const start = markdown.search(re);
  if (start < 0) return "";
  const rest = markdown.slice(start);
  const firstLineEnd = rest.indexOf("\n");
  const bodyStart = firstLineEnd >= 0 ? firstLineEnd + 1 : rest.length;
  const afterHeading = rest.slice(bodyStart);
  const next = afterHeading.search(/^#{2,3}\s/m);
  return next >= 0 ? rest.slice(0, bodyStart + next) : rest;
}

function extractTablesFromBlock(block: string): string[] {
  const tables: string[] = [];
  const lines = block.split("\n");
  let current: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|")) {
      current.push(t);
    } else if (current.length > 0) {
      tables.push(current.join("\n"));
      current = [];
    }
  }
  if (current.length > 0) tables.push(current.join("\n"));
  return tables;
}

function decisionKey(item: Pick<Paso0DecisionItem, "id" | "rule">): string {
  return `${item.id}::${item.rule.slice(0, 120)}`;
}

function collectConfirmedDecisionsFromTable(
  tableBlock: string,
  decisions: Map<string, Paso0DecisionItem>,
): void {
  const { headers, rows } = parseMarkdownTable(tableBlock);
  if (headers.length === 0 || rows.length === 0) return;

  const baseIdx = findColumnIndex(headers, /^base$/i);
  const typeIdx = findColumnIndex(headers, /^tipo$/i, /tipo de afirmaci/i);
  if (baseIdx < 0 || typeIdx < 0) return;

  const classIdx = findColumnIndex(headers, /^clasificaci/i);
  const scopeIdx = findColumnIndex(headers, /regla$/i, /^regla\s/i);
  const ruleIdx = findColumnIndex(
    headers,
    /^regla$/i,
    /^capacidad$/i,
    /^fuera de alcance$/i,
    /^t[eé]rmino$/i,
  );

  for (const row of rows) {
    const assertionType = row[typeIdx] ?? "";
    if (!CONFIRMED_DECISION_TYPE.test(assertionType)) continue;

    const base = row[baseIdx] ?? "";
    const ids = extractDecisionIds(base);
    if (ids.length === 0) continue;

    const ruleText =
      (ruleIdx >= 0 ? row[ruleIdx] : row[0])?.trim() ??
      row.find((c) => c.length > 8)?.trim() ??
      "";
    if (ruleText.length < 4) continue;

    const classification = classIdx >= 0 ? row[classIdx]?.trim() : undefined;
    const scope =
      scopeIdx >= 0 && scopeIdx !== ruleIdx ? row[scopeIdx]?.trim() : undefined;

    for (const id of ids) {
      const item: Paso0DecisionItem = {
        id,
        rule: ruleText,
        classification: classification || undefined,
        assertionType: assertionType.trim(),
        scope: scope || undefined,
      };
      decisions.set(decisionKey(item), item);
    }
  }
}

function extractMvpCapabilities(markdown: string): Paso0MvpCapability[] {
  const block = extractSubsection(markdown, /^###\s+18\.1\s+MVP/im);
  const capabilities: Paso0MvpCapability[] = [];
  for (const table of extractTablesFromBlock(block)) {
    const { headers, rows } = parseMarkdownTable(table);
    if (headers.length === 0) continue;
    const capIdx = findColumnIndex(headers, /^capacidad$/i);
    const ruleIdx = findColumnIndex(headers, /^regla$/i);
    const typeIdx = findColumnIndex(headers, /^tipo$/i);
    const baseIdx = findColumnIndex(headers, /^base$/i);
    const classIdx = findColumnIndex(headers, /^clasificaci/i);
    if (capIdx < 0 || baseIdx < 0) continue;

    for (const row of rows) {
      const title = row[capIdx]?.trim() ?? "";
      if (title.length < 4) continue;
      const typeCell = typeIdx >= 0 ? row[typeIdx] ?? "" : "";
      if (typeIdx >= 0 && !CONFIRMED_DECISION_TYPE.test(typeCell)) continue;

      capabilities.push({
        title: title.replace(/\s+/g, " ").trim(),
        decisionIds: extractDecisionIds(row[baseIdx] ?? ""),
        rule: (ruleIdx >= 0 ? row[ruleIdx] : row[1])?.trim() ?? "Genérica",
        classification: classIdx >= 0 ? row[classIdx]?.trim() : undefined,
      });
    }
  }
  return capabilities;
}

function extractOutOfScope(markdown: string): Paso0OutOfScopeItem[] {
  const block = extractSubsection(markdown, /^###\s+3\.3\s+L[ií]mites confirmados/im);
  const items: Paso0OutOfScopeItem[] = [];
  for (const table of extractTablesFromBlock(block)) {
    const { headers, rows } = parseMarkdownTable(table);
    if (headers.length === 0) continue;
    const ruleIdx = findColumnIndex(headers, /^fuera de alcance$/i, /^regla$/i);
    const typeIdx = findColumnIndex(headers, /^tipo$/i);
    const baseIdx = findColumnIndex(headers, /^base$/i);
    if (ruleIdx < 0) continue;

    for (const row of rows) {
      const rule = row[ruleIdx]?.trim() ?? "";
      if (rule.length < 4) continue;
      if (typeIdx >= 0 && !CONFIRMED_DECISION_TYPE.test(row[typeIdx] ?? "")) continue;
      items.push({
        rule,
        decisionIds: baseIdx >= 0 ? extractDecisionIds(row[baseIdx] ?? "") : undefined,
      });
    }
  }
  return items;
}

function extractEntities(markdown: string): Paso0EntityTerm[] {
  const block = extractSubsection(
    markdown,
    /^###\s+5\.1\s+Lenguaje gen[eé]rico/i,
  );
  const entities: Paso0EntityTerm[] = [];
  for (const table of extractTablesFromBlock(block)) {
    const { headers, rows } = parseMarkdownTable(table);
    if (headers.length === 0) continue;
    const termIdx = findColumnIndex(headers, /^t[eé]rmino$/i);
    const defIdx = findColumnIndex(headers, /^definici/i);
    const baseIdx = findColumnIndex(headers, /^base$/i);
    if (termIdx < 0 || defIdx < 0) continue;

    for (const row of rows) {
      const term = row[termIdx]?.trim() ?? "";
      const definition = row[defIdx]?.trim() ?? "";
      if (term.length < 2 || definition.length < 4) continue;
      entities.push({
        term,
        definition,
        decisionIds: baseIdx >= 0 ? extractDecisionIds(row[baseIdx] ?? "") : undefined,
      });
    }
  }
  return entities;
}

const INVARIANT_D_IDS = new Set(["D-141", "D-142", "D-143"]);

function extractInvariants(markdown: string): string[] {
  const block = extractSubsection(
    markdown,
    /^###\s+8\.3\s+Eventos y confiabilidad/i,
  );
  const invariants: string[] = [];
  for (const table of extractTablesFromBlock(block)) {
    const { headers, rows } = parseMarkdownTable(table);
    if (headers.length === 0) continue;
    const ruleIdx = findColumnIndex(headers, /^regla$/i);
    const baseIdx = findColumnIndex(headers, /^base$/i);
    const typeIdx = findColumnIndex(headers, /^tipo$/i);
    if (ruleIdx < 0 || baseIdx < 0) continue;

    for (const row of rows) {
      const base = row[baseIdx] ?? "";
      const ids = extractDecisionIds(base);
      if (!ids.some((id) => INVARIANT_D_IDS.has(id))) continue;
      if (typeIdx >= 0 && !CONFIRMED_DECISION_TYPE.test(row[typeIdx] ?? "")) continue;
      const rule = row[ruleIdx]?.trim() ?? row[0]?.trim() ?? "";
      if (rule.length >= 8) invariants.push(rule);
    }
  }
  return invariants;
}

function extractRisks(markdown: string): Paso0RiskItem[] {
  const block = extractSubsection(markdown, /^###\s+19\.1\s+Registro de riesgos/im);
  const risks: Paso0RiskItem[] = [];
  for (const table of extractTablesFromBlock(block)) {
    const { headers, rows } = parseMarkdownTable(table);
    if (headers.length === 0) continue;
    const idIdx = findColumnIndex(headers, /^id$/i);
    const nameIdx = findColumnIndex(headers, /^riesgo$/i);
    const mitIdx = findColumnIndex(headers, /^mitigaci/i, /^regla$/i);
    if (idIdx < 0 || nameIdx < 0) continue;

    for (const row of rows) {
      const id = row[idIdx]?.trim() ?? "";
      if (!/^R-\d{3}$/i.test(id)) continue;
      risks.push({
        id: id.toUpperCase(),
        name: row[nameIdx]?.trim() || undefined,
        mitigation: mitIdx >= 0 ? row[mitIdx]?.trim() || undefined : undefined,
      });
    }
  }
  return risks;
}

/**
 * Extrae catálogo estructurado desde markdown Paso 0 definitivo.
 */
export function extractPaso0DecisionCatalog(md: string): Paso0DecisionCatalogExtract {
  const text = md.trim();
  const decisions = new Map<string, Paso0DecisionItem>();

  for (const table of extractTablesFromBlock(text)) {
    collectConfirmedDecisionsFromTable(table, decisions);
  }

  const catalog = paso0DecisionCatalogSchema.parse({
    kind: PASO0_DECISION_CATALOG_KIND,
    version: 1,
    extractedAt: new Date().toISOString(),
    sourceHash: sha256Hex(text),
    decisions: [...decisions.values()].sort((a, b) => a.id.localeCompare(b.id)),
    mvpCapabilities: extractMvpCapabilities(text),
    outOfScope: extractOutOfScope(text),
    entities: extractEntities(text),
    invariants: extractInvariants(text),
    risks: extractRisks(text),
  });

  return enrichPaso0DecisionCatalog(catalog);
}

export function formatPaso0CatalogSummaryBlock(
  catalog: Paso0DecisionCatalog,
  maxChars = 8_000,
): string {
  const lines: string[] = [
    "**Catálogo decisiones Paso 0 (D-ID) — extracto determinístico:**",
    "",
    `Decisiones confirmadas: ${catalog.decisions.length}`,
    `Capacidades MVP (§18.1): ${catalog.mvpCapabilities.length}`,
    `Fuera de alcance (§3.3): ${catalog.outOfScope.length}`,
    `Términos ubicuo (§5.1): ${catalog.entities.length}`,
    `Invariantes (§8.3 D-141–143): ${catalog.invariants.length}`,
    "",
    "**Capacidades MVP (muestra):**",
    ...catalog.mvpCapabilities.slice(0, 25).map(
      (c) =>
        `- ${c.title} [${c.decisionIds.join(", ") || "sin D-ID"}] (${c.rule})`,
    ),
    "",
    "**Decisiones confirmadas (muestra):**",
    ...catalog.decisions.slice(0, 30).map(
      (d) => `- ${d.id}: ${d.rule.slice(0, 160)}${d.rule.length > 160 ? "…" : ""}`,
    ),
  ];

  if (catalog.invariants.length > 0) {
    lines.push("", "**Invariantes clave:**", ...catalog.invariants.map((i) => `- ${i.slice(0, 200)}`));
  }

  const text = lines.join("\n");
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n…[catálogo truncado]`;
}

const AUTH_CAPABILITY_FROM_CATALOG_RE =
  /\b(autenticaci[oó]n|autorizaci[oó]n|login|mfa|ldap|rbac|sso|sesiones?|credenciales|break-glass)\b/i;

/** Convierte capacidades MVP del catálogo Paso 0 a filas BrdCapability. */
export function catalogToBrdCapabilityRows(catalog: Paso0DecisionCatalog): BrdCapability[] {
  return catalog.mvpCapabilities.map((cap, index) => {
    const bodyParts = [
      cap.rule,
      cap.classification ? `Clasificación: ${cap.classification}` : "",
      cap.decisionIds.length > 0 ? `D-IDs: ${cap.decisionIds.join(", ")}` : "",
    ].filter(Boolean);
    const body = bodyParts.join("\n");
    return {
      id: `cap-p0-${index + 1}`,
      title: cap.title,
      body,
      isAuthRelated: AUTH_CAPABILITY_FROM_CATALOG_RE.test(cap.title) || AUTH_CAPABILITY_FROM_CATALOG_RE.test(body),
    };
  });
}

/**
 * Catálogo desde sidecar/JSON o re-extracción determinística del DBGA pegado.
 */
export function resolvePaso0DecisionCatalogForMdd(
  phase0SummaryContent?: string | null,
  dbgaMarkdown?: string | null,
): Paso0DecisionCatalog | null {
  const fromSummary = parsePaso0DecisionCatalog(phase0SummaryContent);
  if (fromSummary) return fromSummary;
  const dbga = dbgaMarkdown?.trim() ?? "";
  if (isPastedDefinitivePaso0(dbga)) {
    return extractPaso0DecisionCatalog(dbga);
  }
  return null;
}

/**
 * Paso 0 definitivo pegado desde fuera de The Forge (sidecar ingest o DBGA STEP_0-like).
 * En ese caso el pipeline MDD no debe sembrar `stage.mddContent` previo.
 */
export function isExternalPastedPaso0ForMddSeed(
  phase0SummaryContent?: string | null,
  dbgaMarkdown?: string | null,
): boolean {
  if (isPaso0PasteSidecarJson(phase0SummaryContent)) return true;
  return isPastedDefinitivePaso0(dbgaMarkdown);
}
