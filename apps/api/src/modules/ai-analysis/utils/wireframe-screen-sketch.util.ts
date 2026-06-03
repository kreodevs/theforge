import { createHash } from "node:crypto";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { sketchLlmBatchSize, sketchLlmConcurrency } from "../../ai/config/llm-config.js";
import { SCREEN_SKETCH_AGENT_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";
import { formatSketchDesignSystemContextBlock } from "./wireframe-design-system-context.util.js";
import { stripMarkdownCell } from "./wireframes-mcp-resolve.util.js";

/** @deprecated Preferir `sketchLlmBatchSize()` (configurable vía env). */
export const SKETCH_LLM_BATCH_SIZE = sketchLlmBatchSize();
const MAX_WIREFRAME_LINES = 48;
const MAX_DESC_CHARS = 280;
const MAX_REFS_CHARS = 100;
const MAX_DS_COMPONENTS_LINE = 320;

const DS_TABLE_ROW_RE =
  /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$/;

export const SCREEN_BLOCK_START = /^<<<SCREEN\s+(.+?)>>>\s*$/m;
export const SCREEN_BLOCK_END = /^<<<END>>>\s*$/m;

export interface ParsedWireframeScreenSection {
  screenName: string;
  body: string;
  description: string;
  wireframeAscii: string;
  useCases: string[];
  userStories: string[];
  dsTableMarkdown: string;
}

export interface WireframesSketchesCacheScreenEntry {
  screenName: string;
  screenHash: string;
  html: string;
}

export interface WireframesSketchesCachePayloadV2 {
  v: 2;
  mddHash: string;
  screens: Record<string, WireframesSketchesCacheScreenEntry>;
}

/** @deprecated v1 — se ignora; fuerza resincronización. */
export interface WireframesSketchesCachePayloadV1 {
  v: 1;
  hash: string;
  sketches: Array<{ screenName: string; html: string }>;
}

/**
 * V3: hash por pantalla semántico (wireframeAscii+descripción+DS), mddHash como
 * metadato UX únicamente — ya no es gate de invalidación global.
 */
export interface WireframesSketchesCachePayloadV3 {
  v: 3;
  /** Metadato para mostrar banner "MDD cambió" en UI. NO invalida caché globalmente. */
  mddHash?: string;
  screens: Record<string, WireframesSketchesCacheScreenEntry>;
}

export function contentDigestHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex").slice(0, 24);
}

/** @deprecated Usar contentDigestHash o screenSectionHash por pantalla. */
export function wireframesContentHash(markdown: string): string {
  return contentDigestHash(markdown);
}

export function normalizeScreenCacheKey(screenName: string): string {
  return slugifyScreenLabel(screenName);
}

/** Quita acentos y unifica guiones/espacios para emparejar título vs slug interno. */
export function slugifyScreenLabel(screenName: string): string {
  return stripMarkdownCell(screenName)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/^pantalla:\s*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Clave laxa para emparejar nombres del LLM con `## Pantalla:` del markdown. */
export function sketchNameMatchKey(screenName: string): string {
  return slugifyScreenLabel(screenName).replace(/^cu[- ]?\d+[a-z0-9]*\s*[-–—:|]\s*/i, "");
}

export function extractScreenIdFromSection(
  section: ParsedWireframeScreenSection,
): string | undefined {
  const m = section.body.match(/\*\*ID\*\*:\s*`([^`]+)`/);
  return m?.[1]?.trim() || undefined;
}

export function matchSketchToSection(
  generatedName: string,
  sections: ParsedWireframeScreenSection[],
): ParsedWireframeScreenSection | undefined {
  const genKey = sketchNameMatchKey(generatedName);
  if (!genKey) return undefined;

  for (const section of sections) {
    if (sketchNameMatchKey(section.screenName) === genKey) return section;
    const screenId = extractScreenIdFromSection(section);
    if (screenId && sketchNameMatchKey(screenId) === genKey) return section;
  }
  for (const section of sections) {
    const secKey = sketchNameMatchKey(section.screenName);
    const idKey = extractScreenIdFromSection(section);
    if (secKey.includes(genKey) || genKey.includes(secKey)) return section;
    if (idKey && (sketchNameMatchKey(idKey).includes(genKey) || genKey.includes(sketchNameMatchKey(idKey)))) {
      return section;
    }
  }
  return undefined;
}

type AnyVersionCache = WireframesSketchesCachePayloadV2 | WireframesSketchesCachePayloadV3;

function findCachedScreenEntry(
  section: ParsedWireframeScreenSection,
  cache: AnyVersionCache,
): WireframesSketchesCacheScreenEntry | undefined {
  const key = normalizeScreenCacheKey(section.screenName);
  const direct = cache.screens[key];
  if (direct?.html?.trim()) return direct;

  for (const entry of Object.values(cache.screens)) {
    if (!entry.html?.trim()) continue;
    if (matchSketchToSection(entry.screenName, [section])) return entry;
  }
  return undefined;
}

function isCachedSectionHit(
  section: ParsedWireframeScreenSection,
  cache: AnyVersionCache,
  cached: WireframesSketchesCacheScreenEntry,
): boolean {
  if (!cached.html?.trim()) return false;
  // Legacy migrated entry (screenHash vacío) — preservar HTML sin verificar hash
  if (!cached.screenHash) return true;
  const hash = screenSectionSemanticHash(section);
  const key = normalizeScreenCacheKey(section.screenName);
  const direct = cache.screens[key];
  if (direct === cached && cached.screenHash === hash) return true;
  if (
    matchSketchToSection(cached.screenName, [section]) != null &&
    cached.screenHash === hash
  ) {
    return true;
  }
  return false;
}

/** @deprecated Usar screenSectionSemanticHash — este hash incluye partes no relevantes del body. */
export function screenSectionHash(section: ParsedWireframeScreenSection): string {
  return contentDigestHash(section.body);
}

/**
 * Hash semántico por pantalla: solo wireframeAscii + descripción + tabla DS.
 * Cambios cosméticos del markdown (reformateo, comentarios, orden de campos fuera
 * del wireframe) no invalidan el boceto.
 */
export function screenSectionSemanticHash(section: ParsedWireframeScreenSection): string {
  const ascii = section.wireframeAscii
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  const normalized = `${ascii}\n||||\n${section.description.trim()}\n||||\n${section.dsTableMarkdown.trim()}`;
  return contentDigestHash(normalized);
}

export function parseWireframeScreensFromMarkdown(markdown: string): ParsedWireframeScreenSection[] {
  const screenRegex = /^## Pantalla:\s*(.+)$/gm;
  const starts: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = screenRegex.exec(markdown)) !== null) {
    starts.push({ name: m[1].trim(), index: m.index });
  }
  if (starts.length === 0) return [];

  const sections: ParsedWireframeScreenSection[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : markdown.length;
    const chunk = markdown.slice(start, end);
    const lines = chunk.split("\n");
    const screenName =
      stripMarkdownCell(starts[i].name.replace(/^Pantalla:\s*/i, "").trim()) || starts[i].name;

    let description = "";
    const useCases: string[] = [];
    const userStories: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      const desc = t.match(/^\*\*Descripci[oó]n\*\*:\s*(.+)/i);
      if (desc?.[1]) description = desc[1].trim();
      const uc = t.match(/^\*\*Casos de uso\*\*:\s*(.+)/i);
      if (uc?.[1]) useCases.push(...uc[1].split(/[,;]\s*/));
      const us = t.match(/^\*\*Historias de usuario\*\*:\s*(.+)/i);
      if (us?.[1]) userStories.push(...us[1].split(/[,;]\s*/));
    }

    const wireframeSection = extractH3(chunk, /^###\s+Wireframe/i);
    let wireframeAscii = "";
    const codeBlock = wireframeSection.match(/```[^\n]*\n([\s\S]*?)```/);
    if (codeBlock?.[1]) wireframeAscii = codeBlock[1].trimEnd();
    else if (wireframeSection.includes("┌") || wireframeSection.includes("│")) {
      wireframeAscii = wireframeSection;
    }

    const dsTableMarkdown = extractH3(
      chunk,
      /^###\s+(Componentes del Design System|Componentes DS)/i,
    );

    sections.push({
      screenName,
      body: chunk,
      description,
      wireframeAscii,
      useCases,
      userStories,
      dsTableMarkdown,
    });
  }
  return sections;
}

function extractH3(body: string, heading: RegExp): string {
  const lines = body.split("\n");
  let capturing = false;
  const out: string[] = [];
  for (const line of lines) {
    if (/^### /.test(line.trim())) {
      if (capturing) break;
      if (heading.test(line.trim())) {
        capturing = true;
        continue;
      }
    }
    if (capturing) out.push(line);
  }
  return out.join("\n").trim();
}

function truncateWireframeAscii(ascii: string): string {
  const lines = ascii.split("\n");
  if (lines.length <= MAX_WIREFRAME_LINES) return ascii.trimEnd();
  return [...lines.slice(0, MAX_WIREFRAME_LINES), "… (recortado)"].join("\n");
}

function compactScreenRefs(section: ParsedWireframeScreenSection): string {
  const refs = [...section.useCases, ...section.userStories].filter(Boolean).join(", ");
  if (!refs) return "";
  return refs.length > MAX_REFS_CHARS ? `${refs.slice(0, MAX_REFS_CHARS)}…` : refs;
}

/** Lista compacta de componentes DS de la pantalla para el prompt de boceto. */
export function compactDsComponentsForSketch(dsTableMarkdown: string): string {
  const table = dsTableMarkdown.trim();
  if (!table) return "";

  const parts: string[] = [];
  let inTable = false;

  for (const line of table.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.includes("Componente requerido") && trimmed.includes("Módulo DS")) {
      inTable = true;
      continue;
    }
    if (inTable && (trimmed.startsWith("|---") || trimmed.startsWith("| ---"))) {
      continue;
    }
    if (inTable && trimmed.startsWith("|")) {
      const rowMatch = DS_TABLE_ROW_RE.exec(trimmed);
      if (!rowMatch) continue;
      const name = stripMarkdownCell(rowMatch[1]);
      const moduleId = stripMarkdownCell(rowMatch[2]);
      const exportName = stripMarkdownCell(rowMatch[3]);
      const confidenceRaw = stripMarkdownCell(rowMatch[4]).toLowerCase();
      const confidence = confidenceRaw.match(/^(exact|partial|none)/)?.[1] ?? confidenceRaw;
      if (confidence === "none" || !moduleId || moduleId === "—") continue;
      const label = exportName && exportName !== "—" ? `${name} (${exportName})` : `${name} (${moduleId})`;
      parts.push(label);
    } else if (inTable && !trimmed.startsWith("|")) {
      inTable = false;
    }
  }

  if (parts.length === 0) return "";
  const joined = parts.join(", ");
  return joined.length > MAX_DS_COMPONENTS_LINE
    ? `${joined.slice(0, MAX_DS_COMPONENTS_LINE)}…`
    : joined;
}

export function buildBatchSketchUserPayload(sections: ParsedWireframeScreenSection[]): string {
  const blocks = sections
    .filter((s) => s.wireframeAscii.trim().length > 10)
    .map((s) => {
      const desc = s.description.slice(0, MAX_DESC_CHARS);
      const refs = compactScreenRefs(s);
      const dsComponents = compactDsComponentsForSketch(s.dsTableMarkdown);
      const wf = truncateWireframeAscii(s.wireframeAscii);
      return [
        `Pantalla: ${s.screenName}`,
        desc ? `Descripción: ${desc}` : "",
        refs ? `Refs: ${refs}` : "",
        dsComponents ? `Componentes DS: ${dsComponents}` : "",
        "Wireframe:",
        wf,
        "",
      ]
        .filter(Boolean)
        .join("\n");
    });
  return blocks.join("\n---\n\n");
}

export function parseBatchSketchResponse(
  raw: string,
  expectedNames: string[],
): Array<{ screenName: string; html: string }> {
  const results: Array<{ screenName: string; html: string }> = [];
  const text = raw.trim();
  const headerRe = /<<<SCREEN\s+(.+?)>>>\s*/g;
  const names: string[] = [];
  const bodies: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    if (names.length > 0) {
      bodies.push(text.slice(lastIndex, m.index));
    }
    names.push(m[1].trim());
    lastIndex = m.index + m[0].length;
  }
  if (names.length > 0) {
    bodies.push(text.slice(lastIndex));
  }
  for (let i = 0; i < names.length; i++) {
    const chunk = bodies[i] ?? "";
    const endIdx = chunk.search(SCREEN_BLOCK_END);
    const htmlRaw = endIdx >= 0 ? chunk.slice(0, endIdx) : chunk;
    const html = sanitizeSketchHtml(extractHtmlFromLlmResponse(htmlRaw.trim()));
    if (html) results.push({ screenName: names[i]!, html });
  }

  if (results.length > 0) return normalizeSketchNames(results, expectedNames);

  // Fallback: JSON { screens: [{ name, html }] }
  try {
    const jsonMatch = text.match(/\{[\s\S]*"screens"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        screens?: Array<{ name?: string; screenName?: string; html?: string }>;
      };
      for (const row of parsed.screens ?? []) {
        const name = (row.screenName ?? row.name ?? "").trim();
        const html = sanitizeSketchHtml(extractHtmlFromLlmResponse(row.html ?? ""));
        if (name && html) results.push({ screenName: name, html });
      }
    }
  } catch {
    /* ignore */
  }
  return normalizeSketchNames(results, expectedNames);
}

function normalizeSketchNames(
  results: Array<{ screenName: string; html: string }>,
  expectedNames: string[],
): Array<{ screenName: string; html: string }> {
  const byKey = new Map<string, { screenName: string; html: string }>();
  for (const r of results) {
    byKey.set(sketchNameMatchKey(r.screenName), r);
  }
  const out: Array<{ screenName: string; html: string }> = [];
  const usedKeys = new Set<string>();

  for (const expected of expectedNames) {
    const key = sketchNameMatchKey(expected);
    let hit = byKey.get(key);
    if (!hit) {
      for (const [rKey, candidate] of byKey) {
        if (usedKeys.has(rKey)) continue;
        if (rKey.includes(key) || key.includes(rKey)) {
          hit = candidate;
          usedKeys.add(rKey);
          break;
        }
      }
    } else {
      usedKeys.add(key);
    }
    if (hit) out.push({ screenName: expected, html: hit.html });
  }
  return out;
}

export function extractHtmlFromLlmResponse(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  if (/^\s*<!doctype/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  const htmlStart = trimmed.search(/<!doctype|<html[\s>]/i);
  if (htmlStart >= 0) return trimmed.slice(htmlStart).trim();
  return trimmed;
}

/** Elimina scripts del boceto por seguridad en iframe sandbox. */
export function sanitizeSketchHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .trim();
}

function wrapFragmentAsHtml(html: string): string {
  if (!/<html[\s>]/i.test(html) && !/<body[\s>]/i.test(html)) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><style>
      body{font-family:system-ui,sans-serif;padding:16px;color:#171717}
    </style></head><body>${html}</body></html>`;
  }
  if (!/<!doctype/i.test(html)) {
    return `<!DOCTYPE html>\n${html}`;
  }
  return html;
}

export type GenerateScreenSketchesBatchResult = {
  generated: Array<{ screenName: string; html: string }>;
  rawLength: number;
  expectedCount: number;
  parsedCount: number;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const workers = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/** Una llamada LLM para un lote de pantallas. */
export async function generateScreenSketchesBatch(
  llm: BaseChatModel,
  sections: ParsedWireframeScreenSection[],
  designSystemBlock = "",
): Promise<GenerateScreenSketchesBatchResult> {
  const targets = sections.filter((s) => s.wireframeAscii.trim().length > 10);
  if (targets.length === 0) {
    return { generated: [], rawLength: 0, expectedCount: 0, parsedCount: 0 };
  }

  const expectedNames = targets.map((s) => s.screenName);
  const payload = buildBatchSketchUserPayload(targets);
  const response = await llm.invoke([
    new HumanMessage(`${SCREEN_SKETCH_AGENT_PROMPT}${designSystemBlock}\n\n---\n${payload}`),
  ]);
  const raw =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((p) => (typeof p === "string" ? p : (p as { text?: string }).text ?? ""))
            .join("")
        : "";

  const parsed = parseBatchSketchResponse(raw, expectedNames);
  const generated = parsed.map((r) => ({
    screenName: r.screenName,
    html: wrapFragmentAsHtml(r.html),
  }));
  return {
    generated,
    rawLength: raw.length,
    expectedCount: expectedNames.length,
    parsedCount: parsed.length,
  };
}

/** Varias llamadas LLM en lotes paralelos (concurrencia acotada). */
export async function generateAllScreenSketches(
  llm: BaseChatModel,
  sections: ParsedWireframeScreenSection[],
  onBatch?: (info: GenerateScreenSketchesBatchResult & { batchIndex: number }) => void,
  designSystemContext?: string,
): Promise<Array<{ screenName: string; html: string }>> {
  const targets = sections.filter((s) => s.wireframeAscii.trim().length > 10);
  if (targets.length === 0) return [];

  const batchSize = sketchLlmBatchSize();
  const concurrency = sketchLlmConcurrency();
  const designSystemBlock = formatSketchDesignSystemContextBlock(designSystemContext);

  const chunks: ParsedWireframeScreenSection[][] = [];
  for (let i = 0; i < targets.length; i += batchSize) {
    chunks.push(targets.slice(i, i + batchSize));
  }

  const batchOutputs = await mapWithConcurrency(chunks, concurrency, async (chunk, batchIndex) => {
    const batch = await generateScreenSketchesBatch(llm, chunk, designSystemBlock);
    onBatch?.({ ...batch, batchIndex });

    const gotKeys = new Set(batch.generated.map((g) => sketchNameMatchKey(g.screenName)));
    const missing = chunk.filter((s) => !gotKeys.has(sketchNameMatchKey(s.screenName)));
    if (missing.length === 0) return batch.generated;

    const retryOutputs = await mapWithConcurrency(
      missing,
      Math.min(concurrency, missing.length),
      async (solo, ri) => {
        const retry = await generateScreenSketchesBatch(llm, [solo], designSystemBlock);
        onBatch?.({ ...retry, batchIndex: batchIndex * 100 + ri + 1 });
        return retry.generated;
      },
    );
    return [...batch.generated, ...retryOutputs.flat()];
  });

  return batchOutputs.flat();
}

/** @deprecated Usar readSketchesCache — soporta v2 y v3. */
export function readSketchesCacheV2(raw: unknown): WireframesSketchesCachePayloadV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<WireframesSketchesCachePayloadV2>;
  if (c.v !== 2 || typeof c.mddHash !== "string" || !c.screens || typeof c.screens !== "object") {
    return null;
  }
  return c as WireframesSketchesCachePayloadV2;
}

/**
 * Lee caché v2 o v3. V2 se migra a v3 en memoria: todos los screens con HTML se
 * preservan con `screenHash=""` (legacy hit) — no se genera ningún boceto extra al
 * desplegar con el nuevo formato.
 */
export function readSketchesCache(raw: unknown): WireframesSketchesCachePayloadV3 | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  if (c["v"] === 3 && c["screens"] && typeof c["screens"] === "object") {
    return c as unknown as WireframesSketchesCachePayloadV3;
  }

  if (c["v"] === 2 && typeof c["mddHash"] === "string" && c["screens"] && typeof c["screens"] === "object") {
    const screens: Record<string, WireframesSketchesCacheScreenEntry> = {};
    for (const [key, entry] of Object.entries(c["screens"] as Record<string, unknown>)) {
      const e = entry as Partial<WireframesSketchesCacheScreenEntry>;
      if (e?.html?.trim() && e.screenName) {
        screens[key] = { screenName: e.screenName, html: e.html, screenHash: "" };
      }
    }
    return { v: 3, mddHash: c["mddHash"] as string, screens };
  }

  return null;
}

function sectionMatchesScreenNames(
  section: ParsedWireframeScreenSection,
  screenNames: string[],
): boolean {
  const key = normalizeScreenCacheKey(section.screenName);
  return screenNames.some(
    (n) => normalizeScreenCacheKey(n) === key || matchSketchToSection(n, [section]) != null,
  );
}

/**
 * Determina qué pantallas necesitan regeneración comparando hash semántico por
 * pantalla contra la caché. mddHash ya NO es gate global — un cambio de MDD no
 * invalida bocetos cuyo wireframeAscii/descripción no cambió.
 */
export function resolveScreensToRegenerate(
  sections: ParsedWireframeScreenSection[],
  cache: WireframesSketchesCachePayloadV2 | WireframesSketchesCachePayloadV3 | null,
  _mddHash: string,
  options: { forceAll?: boolean; screenNames?: string[] },
): {
  toGenerate: ParsedWireframeScreenSection[];
  merged: Map<string, { screenName: string; html: string }>;
} {
  const merged = new Map<string, { screenName: string; html: string }>();
  const forceAll = options.forceAll === true;
  const onlyScreenNames = (options.screenNames ?? []).map((n) => n.trim()).filter(Boolean);

  if (onlyScreenNames.length > 0) {
    const toGenerate: ParsedWireframeScreenSection[] = [];
    for (const section of sections) {
      const key = normalizeScreenCacheKey(section.screenName);
      if (sectionMatchesScreenNames(section, onlyScreenNames)) {
        if (section.wireframeAscii.trim().length > 10) {
          toGenerate.push(section);
        }
        continue;
      }
      // Pantallas no solicitadas: preservar desde caché si existe HTML válido
      if (cache) {
        const cached = findCachedScreenEntry(section, cache);
        if (cached && isCachedSectionHit(section, cache, cached)) {
          merged.set(key, { screenName: section.screenName, html: cached.html });
        }
      }
    }
    return { toGenerate, merged };
  }

  if (forceAll || !cache) {
    return {
      toGenerate: sections.filter((s) => s.wireframeAscii.trim().length > 10),
      merged,
    };
  }

  // Gate per-pantalla: solo regenera si screenHash semántico cambió
  const toGenerate: ParsedWireframeScreenSection[] = [];
  for (const section of sections) {
    const key = normalizeScreenCacheKey(section.screenName);
    const cached = findCachedScreenEntry(section, cache);
    if (cached && isCachedSectionHit(section, cache, cached)) {
      merged.set(key, { screenName: section.screenName, html: cached.html });
    } else if (section.wireframeAscii.trim().length > 10) {
      toGenerate.push(section);
    }
  }
  return { toGenerate, merged };
}

/**
 * Construye payload v3 con hash semántico por pantalla.
 * mddHash se guarda como metadato para detectar staleness en UI pero ya no
 * se usa como invalidador global.
 * @deprecated Nombre mantenido por compatibilidad; escribe formato v3.
 */
export function buildSketchesCachePayloadV2(
  mddHash: string,
  merged: Map<string, { screenName: string; html: string }>,
  sections: ParsedWireframeScreenSection[],
): WireframesSketchesCachePayloadV3 {
  const screens: Record<string, WireframesSketchesCacheScreenEntry> = {};
  const consumed = new Set<string>();

  for (const section of sections) {
    const key = normalizeScreenCacheKey(section.screenName);
    let entry = merged.get(key);
    let mergedKey = key;

    if (!entry?.html?.trim()) {
      for (const [mKey, candidate] of merged) {
        if (consumed.has(mKey) || !candidate.html?.trim()) continue;
        if (matchSketchToSection(candidate.screenName, [section])) {
          entry = candidate;
          mergedKey = mKey;
          break;
        }
      }
    }

    if (!entry?.html?.trim()) continue;
    consumed.add(mergedKey);
    screens[key] = {
      screenName: section.screenName,
      screenHash: screenSectionSemanticHash(section),
      html: entry.html,
    };
  }

  return { v: 3, mddHash, screens };
}

export function cacheToSketchList(
  cache: WireframesSketchesCachePayloadV2 | WireframesSketchesCachePayloadV3,
): Array<{ screenName: string; html: string }> {
  return Object.values(cache.screens)
    .filter((s) => s.html?.trim())
    .map((s) => ({ screenName: s.screenName, html: s.html }));
}

/** True si el markdown tiene al menos una sección `## Pantalla:`. */
export function wireframesHasParseableScreens(markdown: string): boolean {
  return /^## Pantalla:\s*.+$/m.test(markdown.trim());
}

function countWireframeScreens(markdown: string): number {
  return (markdown.match(/^## Pantalla:\s*.+$/gm) ?? []).length;
}

function replaceWireframeScreenSection(current: string, newScreenChunk: string): string | null {
  const nameMatch = newScreenChunk.match(/^## Pantalla:\s*(.+)$/m);
  if (!nameMatch?.[1]) return null;
  const newKey = sketchNameMatchKey(nameMatch[1]);
  if (!newKey) return null;

  const screenRegex = /^## Pantalla:\s*(.+)$/gm;
  const starts: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = screenRegex.exec(current)) !== null) {
    starts.push({ name: m[1].trim(), index: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : current.length;
    if (sketchNameMatchKey(starts[i].name) !== newKey) continue;
    const before = current.slice(0, start).trimEnd();
    const after = current.slice(end).trimStart();
    return [before, newScreenChunk.trim(), after].filter(Boolean).join("\n\n");
  }
  return null;
}

/**
 * Fusiona respuestas parciales del chat con el documento wireframes existente.
 * Evita reemplazar 40k chars por un fragmento cuando el LLM omite ---FIN_WIREFRAMES---.
 */
export function mergeWireframesMarkdownOrUseFull(
  currentDoc: string | undefined,
  newPart: string,
): string {
  const cleaned = newPart.trim();
  if (!cleaned) return (currentDoc ?? "").trim();
  const current = (currentDoc ?? "").trim();
  if (!current) return cleaned;

  const newScreens = countWireframeScreens(cleaned);
  const curScreens = countWireframeScreens(current);
  const hasWireframesH1 = /^#\s*Wireframes\b/im.test(cleaned);

  if (
    hasWireframesH1 &&
    newScreens >= Math.max(1, Math.floor(curScreens * 0.5)) &&
    cleaned.length >= current.length * 0.55
  ) {
    return cleaned;
  }

  if (newScreens === 1 && curScreens >= 1) {
    const merged = replaceWireframeScreenSection(current, cleaned);
    if (merged) return merged;
  }

  if (hasWireframesH1 && cleaned.length >= current.length * 0.85) {
    return cleaned;
  }

  if (cleaned.length < current.length * 0.55) {
    return current;
  }

  return cleaned.length >= current.length ? cleaned : current;
}

/** Rechaza persistir wireframes que borran la mayor parte del documento (fragmento sin merge). */
export function wouldShrinkWireframesDangerously(
  current: string,
  next: string,
  minRatio = 0.55,
): boolean {
  const c = current.trim();
  const n = next.trim();
  if (!c || c.length < 400) return false;
  if (!n) return true;
  if (n.length >= c.length * minRatio) return false;
  if (/^#\s*Wireframes\b/im.test(n) && n.length >= Math.min(c.length * 0.85, 2500)) return false;
  const curScreens = countWireframeScreens(c);
  const nextScreens = countWireframeScreens(n);
  if (nextScreens >= Math.max(1, Math.floor(curScreens * 0.5))) return false;
  return true;
}
