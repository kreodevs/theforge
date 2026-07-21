/**
 * Pre-parche BRD→MDD: inyecta reglas, permisos y fórmulas faltantes en §1/§5 antes del pipeline.
 */

import { extractBrdTraceabilityItems } from "../ai-analysis/estimation/consistency.util.js";
import { extractSectionByNumber } from "./mdd-markdown-parser.js";

function replaceSectionBody(md: string, sectionNum: number, newSectionBody: string): string {
  const re = /^##\s*(\d+)\.\s*[^\n]*/gim;
  const matches: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    matches.push({ num: parseInt(m[1]!, 10), index: m.index });
  }
  const idx = matches.findIndex((x) => x.num === sectionNum);
  if (idx === -1) {
    return `${md.trim()}\n\n${newSectionBody.trim()}\n`;
  }
  const start = matches[idx]!.index;
  const end = matches[idx + 1]?.index ?? md.length;
  return `${md.slice(0, start)}${newSectionBody.trim()}\n${md.slice(end)}`.trim();
}

function corpusForTrace(mdd: string): string {
  const s1 = extractSectionByNumber(mdd, 1) ?? "";
  const s4 = extractSectionByNumber(mdd, 4) ?? "";
  const s5 = extractSectionByNumber(mdd, 5) ?? "";
  return `${s1}\n${s4}\n${s5}`.toLowerCase();
}

function tokenOverlap(label: string, corpus: string): number {
  const words = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (words.length === 0) return 1;
  const hits = words.filter((w) => corpus.includes(w));
  return hits.length / words.length;
}

function injectBlock(sectionMarkdown: string, heading: string, body: string): string {
  if (sectionMarkdown.includes(body.slice(0, 40))) return sectionMarkdown;
  return `${sectionMarkdown.trim()}\n\n### ${heading}\n\n${body}\n`;
}

export type BrdMddPrePatchResult = {
  markdown: string;
  injected: string[];
};

/** Añade al MDD conceptos BRD con cobertura parcial o ausente (< 40% tokens). */
export function patchMddFromBrdTraceability(
  mddMarkdown: string,
  brdMarkdown: string | null | undefined,
): BrdMddPrePatchResult {
  const brd = (brdMarkdown ?? "").trim();
  if (!brd || brd.length < 200 || !mddMarkdown.trim()) {
    return { markdown: mddMarkdown, injected: [] };
  }

  const items = extractBrdTraceabilityItems(brd);
  const corpus = corpusForTrace(mddMarkdown);
  const injected: string[] = [];
  let markdown = mddMarkdown;

  const missing = items.filter((item) => tokenOverlap(item.label, corpus) < 0.4);
  if (missing.length === 0) {
    return { markdown, injected };
  }

  let s1 = extractSectionByNumber(markdown, 1) || "## 1. Contexto\n";
  let s5 = extractSectionByNumber(markdown, 5) || "## 5. Lógica de Negocio\n";

  for (const item of missing.slice(0, 12)) {
    const kind = item.kind ?? "rule";
    const label = item.label.slice(0, 200);
    const note = `*(Auto-trazabilidad BRD: ${item.brdSection ?? "BRD"} / ${item.brdSubsection ?? "—"})*`;

    if (kind === "permission" || kind === "formula" || kind === "rule") {
      s5 = injectBlock(s5, `BRD — ${label.slice(0, 60)}`, `- ${label}\n${note}`);
      injected.push(`§5: ${label.slice(0, 80)}`);
    } else {
      s1 = injectBlock(s1, `BRD — ${label.slice(0, 60)}`, `- ${label}\n${note}`);
      injected.push(`§1: ${label.slice(0, 80)}`);
    }
  }

  if (injected.some((x) => x.startsWith("§1"))) {
    markdown = replaceSectionBody(markdown, 1, s1);
  }
  if (injected.some((x) => x.startsWith("§5"))) {
    markdown = replaceSectionBody(markdown, 5, s5);
  }

  return { markdown, injected };
}
