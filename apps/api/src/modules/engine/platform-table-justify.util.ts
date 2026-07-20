/**
 * Justificación de tablas plataforma (messages, mcp_plugins, conversation_memory)
 * alineada con capacidades BRD/DBGA/MDD §1 — evita falsos domain-platform-orphan.
 */

import {
  PLATFORM_ORPHAN_TABLES,
  type DomainInventory,
} from "@theforge/shared-types";
import { extractEntities } from "./conformance.service.js";
import { extractBrdCapabilities } from "./domain-inventory.util.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

/** Patrones de negocio/plataforma que anclan cada tabla huérfana. */
const PLATFORM_ANCHOR_PATTERNS: Record<string, RegExp> = {
  messages: /\b(mensajes?|messages?|chat|conversaci[oó]n|whatsapp|canal\s+de\s+mensajer[ií]a|inbox)\b/i,
  mcp_plugins: /\b(mcp\b|model\s+context\s+protocol|plugins?\b|herramientas?\s+(?:mcp|externas)|integraci[oó]n\s+mcp|multi[- ]?agente|agente\s+ia|bitrix|tooling)\b/i,
  conversation_memory: /\b(memoria\b|contexto\s+(?:de\s+)?conversaci[oó]n|historial\s+de\s+chat|rag\b|embeddings?|recuperaci[oó]n\s+sem[aá]ntica|contexto\s+del\s+agente)\b/i,
};

function corpus(params: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown?: string | null;
  specMarkdown?: string | null;
}): string {
  const section1 = params.mddMarkdown
    ? extractSectionByNumber(params.mddMarkdown, 1) ?? ""
    : "";
  // Solo prosa de negocio — no §3 SQL (los nombres CREATE TABLE no son ancla).
  return [params.brdMarkdown, params.dbgaMarkdown, params.specMarkdown, section1]
    .filter(Boolean)
    .join("\n");
}

function brdCapabilitiesAnchor(table: string, brdMarkdown?: string | null): boolean {
  const pattern = PLATFORM_ANCHOR_PATTERNS[table];
  if (!pattern || !brdMarkdown?.trim()) return false;
  const caps = extractBrdCapabilities(brdMarkdown);
  return caps.some((c) => pattern.test(`${c.title} ${c.body}`));
}

function mddSection3HasPlatformTag(section3: string, table: string): boolean {
  if (new RegExp(`\\[platform[_:\\s-]*${table.replace(/_/g, "[_-]*")}\\]`, "i").test(section3)) {
    return true;
  }
  if (
    new RegExp(
      `--\\s*\\[platform[^\\n]*${table.replace(/_/g, "[_-]*")}|platform_infra[^\\n]*${table.replace(/_/g, "[_-]*")}`,
      "i",
    ).test(section3)
  ) {
    return true;
  }
  return false;
}

/** True si la tabla plataforma está anclada en BRD/DBGA/MDD §1, inventario o metadata §3. */
export function isPlatformTableJustified(
  table: string,
  params: {
    brdMarkdown?: string | null;
    dbgaMarkdown?: string | null;
    mddMarkdown?: string | null;
    specMarkdown?: string | null;
    inventory?: DomainInventory | null;
  },
): boolean {
  if (!PLATFORM_ORPHAN_TABLES.has(table)) return true;

  const section3 =
    extractSectionByNumber(params.mddMarkdown ?? "", 3) || params.mddMarkdown || "";
  if (mddSection3HasPlatformTag(section3, table)) return true;

  const text = corpus(params);
  const pattern = PLATFORM_ANCHOR_PATTERNS[table];
  if (pattern?.test(text)) return true;

  if (brdCapabilitiesAnchor(table, params.brdMarkdown)) return true;

  if (params.inventory?.suggestedEntities?.includes(table)) {
    const invPattern = pattern ?? new RegExp(table.replace(/_/g, "[\\s_-]*"), "i");
    if (invPattern.test(text)) return true;
    const capBodies = (params.inventory.capabilities ?? [])
      .map((c) => `${c.title} ${c.body}`)
      .join("\n");
    if (invPattern.test(capBodies)) return true;
  }

  return false;
}

export function listUnjustifiedPlatformTables(params: {
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  mddMarkdown: string;
  specMarkdown?: string | null;
  inventory?: DomainInventory | null;
}): string[] {
  const section3 = extractSectionByNumber(params.mddMarkdown ?? "", 3) || params.mddMarkdown || "";
  const mddEntities = extractEntities(section3);
  const orphans: string[] = [];
  for (const table of PLATFORM_ORPHAN_TABLES) {
    if (!mddEntities.has(table)) continue;
    if (isPlatformTableJustified(table, params)) continue;
    orphans.push(table);
  }
  return orphans;
}

const PLATFORM_SQL_COMMENT: Record<string, string> = {
  mcp_plugins:
    "-- [platform:mcp_plugins] Runtime MCP / herramientas externas (anclado BRD capacidades agente-MCP; no entidad de negocio pura).",
  conversation_memory:
    "-- [platform:conversation_memory] Memoria contextual del agente/chat (anclado capacidades conversación/RAG; no entidad de negocio pura).",
  messages:
    "-- [platform:messages] Mensajería/chat operacional (anclado capacidades conversación/canal; no entidad de negocio pura).",
};

/**
 * Antes del delivery gate: anota CREATE TABLE plataforma justificados por BRD/MDD
 * para que auditorías posteriores reconozcan el ancla sin bloquear cascada.
 */
export function annotateJustifiedPlatformTablesInMdd(
  mddMarkdown: string,
  params: {
    brdMarkdown?: string | null;
    dbgaMarkdown?: string | null;
    specMarkdown?: string | null;
    inventory?: DomainInventory | null;
  },
): { markdown: string; annotated: string[] } {
  let out = mddMarkdown ?? "";
  const annotated: string[] = [];
  for (const table of PLATFORM_ORPHAN_TABLES) {
    if (!isPlatformTableJustified(table, { ...params, mddMarkdown: out })) continue;
    const createRe = new RegExp(
      `(CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?["']?${table}["']?\\s*\\()`,
      "i",
    );
    if (!createRe.test(out)) continue;
    const comment = PLATFORM_SQL_COMMENT[table];
    if (!comment || out.includes(`[platform:${table}]`)) continue;
    out = out.replace(createRe, `${comment}\n$1`);
    annotated.push(table);
  }
  return { markdown: out, annotated };
}
