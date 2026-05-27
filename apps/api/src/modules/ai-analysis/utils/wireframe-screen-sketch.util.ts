import { createHash } from "node:crypto";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { SCREEN_SKETCH_AGENT_PROMPT } from "../prompts/wireframes/wireframes-prompts.js";

/** Pantallas por llamada LLM (evita contexto/ salida enorme). */
export const SKETCH_LLM_BATCH_SIZE = 6;
const MAX_WIREFRAME_LINES = 48;
const MAX_DESC_CHARS = 280;
const MAX_REFS_CHARS = 160;

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

export function contentDigestHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex").slice(0, 24);
}

/** @deprecated Usar contentDigestHash o screenSectionHash por pantalla. */
export function wireframesContentHash(markdown: string): string {
  return contentDigestHash(markdown);
}

export function normalizeScreenCacheKey(screenName: string): string {
  return screenName
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/^pantalla:\s*/i, "")
    .replace(/\s+/g, " ");
}

/** Clave laxa para emparejar nombres del LLM con `## Pantalla:` del markdown. */
export function sketchNameMatchKey(screenName: string): string {
  return normalizeScreenCacheKey(screenName).replace(/^cu[- ]?\d+[a-z0-9]*\s*[-–—:|]\s*/i, "");
}

export function matchSketchToSection(
  generatedName: string,
  sections: ParsedWireframeScreenSection[],
): ParsedWireframeScreenSection | undefined {
  const genKey = sketchNameMatchKey(generatedName);
  if (!genKey) return undefined;

  for (const section of sections) {
    if (sketchNameMatchKey(section.screenName) === genKey) return section;
  }
  for (const section of sections) {
    const secKey = sketchNameMatchKey(section.screenName);
    if (secKey.includes(genKey) || genKey.includes(secKey)) return section;
  }
  return undefined;
}

export function screenSectionHash(section: ParsedWireframeScreenSection): string {
  return contentDigestHash(section.body);
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
    const screenName = starts[i].name.replace(/^Pantalla:\s*/i, "").trim() || starts[i].name;

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

export function buildBatchSketchUserPayload(sections: ParsedWireframeScreenSection[]): string {
  const blocks = sections
    .filter((s) => s.wireframeAscii.trim().length > 10)
    .map((s) => {
      const desc = s.description.slice(0, MAX_DESC_CHARS);
      const refs = compactScreenRefs(s);
      const wf = truncateWireframeAscii(s.wireframeAscii);
      return [
        `Pantalla: ${s.screenName}`,
        desc ? `Descripción: ${desc}` : "",
        refs ? `Refs: ${refs}` : "",
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
  for (const r of results) {
    const rKey = sketchNameMatchKey(r.screenName);
    if (usedKeys.has(rKey)) continue;
    if (!out.some((o) => sketchNameMatchKey(o.screenName) === rKey)) {
      out.push(r);
    }
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

/** Una llamada LLM para un lote de pantallas (máx. SKETCH_LLM_BATCH_SIZE). */
export async function generateScreenSketchesBatch(
  llm: BaseChatModel,
  sections: ParsedWireframeScreenSection[],
): Promise<GenerateScreenSketchesBatchResult> {
  const targets = sections.filter((s) => s.wireframeAscii.trim().length > 10);
  if (targets.length === 0) {
    return { generated: [], rawLength: 0, expectedCount: 0, parsedCount: 0 };
  }

  const expectedNames = targets.map((s) => s.screenName);
  const payload = buildBatchSketchUserPayload(targets);
  const response = await llm.invoke([
    new HumanMessage(`${SCREEN_SKETCH_AGENT_PROMPT}\n\n---\n${payload}`),
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

/** Varias llamadas LLM si hay más pantallas que SKETCH_LLM_BATCH_SIZE. */
export async function generateAllScreenSketches(
  llm: BaseChatModel,
  sections: ParsedWireframeScreenSection[],
  onBatch?: (info: GenerateScreenSketchesBatchResult & { batchIndex: number }) => void,
): Promise<Array<{ screenName: string; html: string }>> {
  const targets = sections.filter((s) => s.wireframeAscii.trim().length > 10);
  const results: Array<{ screenName: string; html: string }> = [];

  for (let i = 0; i < targets.length; i += SKETCH_LLM_BATCH_SIZE) {
    const chunk = targets.slice(i, i + SKETCH_LLM_BATCH_SIZE);
    const batchIndex = Math.floor(i / SKETCH_LLM_BATCH_SIZE);
    const batch = await generateScreenSketchesBatch(llm, chunk);
    onBatch?.({ ...batch, batchIndex });
    results.push(...batch.generated);

    const gotKeys = new Set(batch.generated.map((g) => sketchNameMatchKey(g.screenName)));
    const missing = chunk.filter((s) => !gotKeys.has(sketchNameMatchKey(s.screenName)));
    for (let ri = 0; ri < missing.length; ri++) {
      const solo = missing[ri]!;
      const retry = await generateScreenSketchesBatch(llm, [solo]);
      onBatch?.({ ...retry, batchIndex: batchIndex * 100 + ri + 1 });
      results.push(...retry.generated);
    }
  }
  return results;
}

export function readSketchesCacheV2(raw: unknown): WireframesSketchesCachePayloadV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<WireframesSketchesCachePayloadV2>;
  if (c.v !== 2 || typeof c.mddHash !== "string" || !c.screens || typeof c.screens !== "object") {
    return null;
  }
  return c as WireframesSketchesCachePayloadV2;
}

export function resolveScreensToRegenerate(
  sections: ParsedWireframeScreenSection[],
  cache: WireframesSketchesCachePayloadV2 | null,
  mddHash: string,
  options: { forceAll?: boolean },
): {
  toGenerate: ParsedWireframeScreenSection[];
  merged: Map<string, { screenName: string; html: string }>;
} {
  const merged = new Map<string, { screenName: string; html: string }>();
  const forceAll = options.forceAll === true;

  if (forceAll || !cache || cache.mddHash !== mddHash) {
    return {
      toGenerate: sections.filter((s) => s.wireframeAscii.trim().length > 10),
      merged,
    };
  }

  const toGenerate: ParsedWireframeScreenSection[] = [];
  for (const section of sections) {
    const key = normalizeScreenCacheKey(section.screenName);
    const hash = screenSectionHash(section);
    const cached = cache.screens[key];
    if (cached?.screenHash === hash && cached.html?.trim()) {
      merged.set(key, { screenName: section.screenName, html: cached.html });
    } else if (section.wireframeAscii.trim().length > 10) {
      toGenerate.push(section);
    }
  }
  return { toGenerate, merged };
}

export function buildSketchesCachePayloadV2(
  mddHash: string,
  merged: Map<string, { screenName: string; html: string }>,
  sections: ParsedWireframeScreenSection[],
): WireframesSketchesCachePayloadV2 {
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
      screenHash: screenSectionHash(section),
      html: entry.html,
    };
  }

  for (const [mKey, entry] of merged) {
    if (consumed.has(mKey) || !entry.html?.trim()) continue;
    const section = matchSketchToSection(entry.screenName, sections);
    if (section) {
      const key = normalizeScreenCacheKey(section.screenName);
      if (screens[key]?.html?.trim()) continue;
      screens[key] = {
        screenName: section.screenName,
        screenHash: screenSectionHash(section),
        html: entry.html,
      };
    } else {
      screens[mKey] = {
        screenName: entry.screenName,
        screenHash: contentDigestHash(entry.html),
        html: entry.html,
      };
    }
    consumed.add(mKey);
  }

  return { v: 2, mddHash, screens };
}

export function cacheToSketchList(
  cache: WireframesSketchesCachePayloadV2,
): Array<{ screenName: string; html: string }> {
  return Object.values(cache.screens)
    .filter((s) => s.html?.trim())
    .map((s) => ({ screenName: s.screenName, html: s.html }));
}
