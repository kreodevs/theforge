/**
 * Conformidad UAT BRD → MDD §1 (regresión: escenarios perdidos en regeneración).
 */

import { extractSectionByNumber } from "./mdd-markdown-parser.js";

export type UatScenarioRef = {
  id: string;
  number: number | null;
  title: string;
  snippet: string;
  keywords: string[];
};

const UAT_SECTION_RE =
  /(?:criterios de aceptaci[oó]n|escenarios?\s+uat|uat\b|pruebas de aceptaci)/i;

const SCENARIO_HEADING_RE =
  /^\s*(?:\*{2})?\s*escenario\s*(\d+)\s*[-–—:]\s*(.+?)\s*(?:\*{2})?\s*$/gim;

const KEYWORD_ANCHORS = [
  "fraccionamiento",
  "idempotencia",
  "idempotent",
  "limite ia",
  "límite ia",
  "stop-loss",
  "stop loss",
  "quota",
  "token",
];

function tokenizeKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found = KEYWORD_ANCHORS.filter((k) => lower.includes(k));
  const nums = [...lower.matchAll(/escenario\s*(\d+)/gi)].map((m) => `escenario-${m[1]}`);
  return [...new Set([...found, ...nums])];
}

function extractUatBlock(markdown: string): string {
  const text = (markdown ?? "").trim();
  if (!text) return "";
  const lines = text.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s/.test(line) && UAT_SECTION_RE.test(line)) {
      start = i;
      break;
    }
    if (/^###\s/.test(line) && UAT_SECTION_RE.test(line)) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    const idx = text.search(UAT_SECTION_RE);
    return idx >= 0 ? text.slice(idx, idx + 8000) : "";
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+\d/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

export function extractBrdUatScenarios(brdMarkdown: string): UatScenarioRef[] {
  const block = extractUatBlock(brdMarkdown);
  if (block.length < 20) return [];

  const scenarios: UatScenarioRef[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  SCENARIO_HEADING_RE.lastIndex = 0;
  while ((match = SCENARIO_HEADING_RE.exec(block)) !== null) {
    const num = parseInt(match[1] ?? "", 10);
    const title = (match[2] ?? "").trim();
    if (!title) continue;
    const id = Number.isFinite(num) ? `uat-${num}` : `uat-${title.slice(0, 24)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    scenarios.push({
      id,
      number: Number.isFinite(num) ? num : null,
      title,
      snippet: title,
      keywords: tokenizeKeywords(`${title} ${block.slice(match.index, match.index + 400)}`),
    });
  }

  if (scenarios.length === 0) {
    const gherkinBlocks = block.split(/(?=^\s*(?:-\s*)?(?:dado|cuando|entonces)\s+)/gim);
    let n = 0;
    for (const chunk of gherkinBlocks) {
      if (!/^(?:-\s*)?(?:dado|cuando)/im.test(chunk.trim())) continue;
      n += 1;
      const snippet = chunk.trim().slice(0, 200);
      scenarios.push({
        id: `uat-gh-${n}`,
        number: n,
        title: snippet.split("\n")[0]?.slice(0, 80) ?? `Escenario ${n}`,
        snippet,
        keywords: tokenizeKeywords(snippet),
      });
    }
  }

  return scenarios;
}

export function extractMddUatScenarios(mddMarkdown: string): UatScenarioRef[] {
  const section1 = extractSectionByNumber(mddMarkdown ?? "", 1) || "";
  const block = extractUatBlock(section1) || section1;
  return extractBrdUatScenarios(block).map((s) => ({ ...s, id: `mdd-${s.id}` }));
}

function scenarioMatchesInMdd(brdScenario: UatScenarioRef, mddScenarios: UatScenarioRef[]): boolean {
  if (brdScenario.number != null) {
    if (mddScenarios.some((m) => m.number === brdScenario.number)) return true;
  }
  const brdKeys = new Set(brdScenario.keywords);
  for (const m of mddScenarios) {
    if (brdScenario.title.length > 8 && m.title.toLowerCase().includes(brdScenario.title.toLowerCase().slice(0, 12))) {
      return true;
    }
    const overlap = m.keywords.filter((k) => brdKeys.has(k));
    if (overlap.length >= 1 && brdKeys.size > 0) return true;
    if (m.keywords.some((k) => brdScenario.snippet.toLowerCase().includes(k))) return true;
  }
  const corpus = mddScenarios.map((m) => `${m.title} ${m.snippet}`).join("\n").toLowerCase();
  const anchorKeywords = brdScenario.keywords.filter((k) => !k.startsWith("escenario-"));
  if (anchorKeywords.length > 0 && anchorKeywords.some((k) => corpus.includes(k))) {
    return true;
  }
  if (brdScenario.number != null && corpus.includes(`escenario ${brdScenario.number}`)) {
    return true;
  }
  return brdScenario.title.length >= 10 && corpus.includes(brdScenario.title.toLowerCase().slice(0, 20));
}

export type BrdMddUatConformanceReport = {
  brdCount: number;
  mddCount: number;
  missingInMdd: UatScenarioRef[];
  gaps: string[];
};

export function checkBrdMddUatConformance(params: {
  brdMarkdown?: string | null;
  mddMarkdown: string;
}): BrdMddUatConformanceReport {
  const brdScenarios = extractBrdUatScenarios(params.brdMarkdown ?? "");
  const mddScenarios = extractMddUatScenarios(params.mddMarkdown);
  const missingInMdd = brdScenarios.filter((b) => !scenarioMatchesInMdd(b, mddScenarios));
  const gaps: string[] = [];

  if (brdScenarios.length >= 2 && missingInMdd.length > 0) {
    gaps.push(
      `[UAT] MDD §1 cubre ${mddScenarios.length}/${brdScenarios.length} escenarios UAT del BRD — faltan: ${missingInMdd
        .map((s) => (s.number != null ? `#${s.number} ${s.title}` : s.title))
        .slice(0, 6)
        .join("; ")}`,
    );
  }

  return {
    brdCount: brdScenarios.length,
    mddCount: mddScenarios.length,
    missingInMdd,
    gaps,
  };
}

/** Inserta escenarios UAT faltantes al final del bloque UAT en §1. */
export function injectMissingUatScenariosIntoMdd(
  mddMarkdown: string,
  missing: UatScenarioRef[],
): { markdown: string; injected: string[] } {
  if (missing.length === 0) return { markdown: mddMarkdown, injected: [] };
  const injected: string[] = [];
  const appendix = missing
    .map((s) => {
      injected.push(s.id);
      const label = s.number != null ? `Escenario ${s.number}` : "Escenario";
      return `\n**${label} — ${s.title}** (sincronizado desde BRD — regeneración UAT)\n\n${s.snippet.slice(0, 500)}\n`;
    })
    .join("\n");

  const section1 = extractSectionByNumber(mddMarkdown, 1);
  if (!section1) {
    return {
      markdown: `${mddMarkdown.trimEnd()}\n\n## 1. Contexto y Alcance\n\n### Criterios de Aceptación (UAT)\n${appendix}\n`,
      injected,
    };
  }

  const uatIdx = section1.search(UAT_SECTION_RE);
  if (uatIdx < 0) {
    const newSection1 = `${section1.trimEnd()}\n\n### Criterios de Aceptación (UAT)\n${appendix}\n`;
    return { markdown: mddMarkdown.replace(section1, newSection1), injected };
  }

  const newSection1 = section1.trimEnd() + appendix;
  return { markdown: mddMarkdown.replace(section1, newSection1), injected };
}
