/**
 * Compact DBGA extract for Clarifier prompts — avoids dumping full benchmark text.
 * Never blind slice(0, N) as the only strategy: narrative head + structural signals.
 */

import type { DomainInventory, Paso0DecisionCatalog } from "@theforge/shared-types";
import { formatPaso0CatalogGuardBlock } from "@theforge/shared-types";
import { formatDomainInventoryForPrompt } from "../../engine/domain-inventory.util.js";
import { formatPaso0CatalogSummaryBlock } from "../phase0/paso0-pasted-definitive.util.js";

/** Total DBGA brief budget (narrative + signals; inventory/stack are separate blocks). */
export const DEFAULT_CLARIFIER_DBGA_BRIEF_MAX_CHARS = 8_000;

/** Budget when Paso 0 definitivo pegado (catálogo D-ID) alimenta el pipeline. */
export const DEFAULT_CLARIFIER_PASO0_PASTED_MAX_CHARS = 120_000;

/** Narrative head budget for objective/scope/out-of-scope H2s. */
const NARRATIVE_BUDGET_CHARS = 3_000;

/** Mid/end structural signals (headings + one-liners). */
const SIGNALS_BUDGET_CHARS = 2_500;

const NARRATIVE_H2_RE =
  /^(?:objetivo|objective|alcance|scope|contexto|context|fuera\s+de\s+alcance|out\s+of\s+scope|stakeholders?|usuarios?|criterios?\s+de\s+[ée]xito|success\s+criteria|problema|problem|visi[oó]n|resumen\s+ejecutivo)/i;

const SIGNAL_H_RE =
  /^(?:\d+\.?\s*)?(?:capacidad|capacidades|entidad|entidades|tabla|tablas|matriz|flujo|flujos|integraci[oó]n|api|endpoint|requisito|funcional|proceso|journey|user\s+story|historia|competidor|benchmark|stack|tecnolog)/i;

export type BuildClarifierDbgaBriefParams = {
  dbgaContent: string;
  /** When provided, included in returned meta (inventory is injected separately in the node). */
  inventory?: DomainInventory;
  maxChars?: number;
  paso0Catalog?: Paso0DecisionCatalog | null;
};

export type ClarifierDbgaBriefResult = {
  brief: string;
  briefChars: number;
  usedFullDbga: boolean;
  narrativeChars: number;
  signalsChars: number;
};

function extractH2Sections(md: string): Array<{ title: string; body: string; start: number }> {
  const sections: Array<{ title: string; body: string; start: number }> = [];
  const headingRe = /^##\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  const headings: Array<{ title: string; start: number }> = [];
  while ((match = headingRe.exec(md)) !== null) {
    headings.push({ title: (match[1] ?? "").trim(), start: match.index });
  }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    const end = i + 1 < headings.length ? headings[i + 1]!.start : md.length;
    const body = md.slice(h.start, end).replace(/^##\s+.+$/m, "").trim();
    sections.push({ title: h.title, body, start: h.start });
  }
  return sections;
}

function extractH3Signals(md: string): Array<{ title: string; line: string }> {
  const signals: Array<{ title: string; line: string }> = [];
  const headingRe = /^###\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(md)) !== null) {
    const title = (match[1] ?? "").trim();
    if (!title || !SIGNAL_H_RE.test(title)) continue;
    const after = md.slice(match.index + match[0].length);
    const firstLine =
      after
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0 && !/^#{1,6}\s/.test(l)) ?? "";
    const oneLiner = firstLine.replace(/\*\*/g, "").slice(0, 140).trim();
    signals.push({ title, line: oneLiner || "(ver DBGA)" });
  }
  return signals;
}

function demoteHeadingsForSection1Embed(text: string): string {
  return (text ?? "")
    .replace(/^#### /gm, "##### ")
    .replace(/^### /gm, "#### ")
    .replace(/^## /gm, "### ");
}

function buildNarrativeHead(sections: Array<{ title: string; body: string }>, budget: number): string {
  const picked: string[] = [];
  let used = 0;
  for (const s of sections) {
    if (!NARRATIVE_H2_RE.test(s.title.replace(/^\d+\.?\s*/, ""))) continue;
    const block = `### ${s.title}\n\n${s.body}`.trim();
    if (used + block.length > budget && picked.length > 0) {
      const remaining = budget - used - 40;
      if (remaining > 200) {
        picked.push(`### ${s.title}\n\n${s.body.slice(0, remaining)}…`);
      }
      break;
    }
    picked.push(block);
    used += block.length + 2;
    if (used >= budget) break;
  }
  if (picked.length === 0 && sections.length > 0) {
    const first = sections[0]!;
    const block = `### ${first.title}\n\n${first.body}`.trim();
    return block.length <= budget ? block : block.slice(0, budget) + "…";
  }
  return picked.join("\n\n");
}

function buildStructuralSignals(
  sections: Array<{ title: string; body: string }>,
  h3Signals: Array<{ title: string; line: string }>,
  budget: number,
): string {
  const lines: string[] = ["**Señales estructurales DBGA (resumen):**"];
  let used = lines[0]!.length;

  for (const s of sections) {
    const title = s.title.replace(/^\d+\.?\s*/, "");
    if (!SIGNAL_H_RE.test(title)) continue;
    const firstLine =
      s.body
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? "";
    const oneLiner = `- **${title}:** ${firstLine.replace(/\*\*/g, "").slice(0, 120) || "(ver DBGA)"}`;
    if (used + oneLiner.length > budget) break;
    lines.push(oneLiner);
    used += oneLiner.length + 1;
  }

  for (const sig of h3Signals) {
    const oneLiner = `- **${sig.title}:** ${sig.line}`;
    if (used + oneLiner.length > budget) break;
    if (lines.some((l) => l.includes(sig.title))) continue;
    lines.push(oneLiner);
    used += oneLiner.length + 1;
  }

  return lines.length > 1 ? lines.join("\n") : "";
}

/** Resuelve presupuesto DBGA para Clarifier según catálogo Paso 0 pegado. */
export function resolveClarifierDbgaBriefMaxChars(catalog?: Paso0DecisionCatalog | null): number {
  if (!catalog) return DEFAULT_CLARIFIER_DBGA_BRIEF_MAX_CHARS;
  const env = process.env.CLARIFIER_PASO0_PASTED_MAX_CHARS;
  const parsed = env ? Number.parseInt(env, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_CLARIFIER_PASO0_PASTED_MAX_CHARS;
}

function buildPaso0PastedBrief(
  dbga: string,
  catalog: Paso0DecisionCatalog,
  maxChars: number,
): ClarifierDbgaBriefResult {
  const sections = extractH2Sections(dbga);
  const catalogBlock = formatPaso0CatalogSummaryBlock(catalog, Math.min(12_000, Math.floor(maxChars * 0.35)));
  const guardBlock = formatPaso0CatalogGuardBlock(catalog, Math.min(6_000, Math.floor(maxChars * 0.25)));
  const narrativeBudget = Math.min(NARRATIVE_BUDGET_CHARS * 3, Math.floor(maxChars * 0.45));
  const signalsBudget = Math.min(SIGNALS_BUDGET_CHARS * 2, Math.floor(maxChars * 0.2));
  const narrative = buildNarrativeHead(sections, narrativeBudget);
  const signals = buildStructuralSignals(sections, extractH3Signals(dbga), signalsBudget);

  const parts = [
    catalogBlock,
    guardBlock,
    "**DBGA (narrativa y señales — Paso 0 definitivo pegado):**",
    narrative,
    signals,
  ].filter(Boolean);

  let brief = parts.join("\n\n").trim();
  if (brief.length > maxChars) {
    brief = brief.slice(0, maxChars) + "\n…[DBGA+catálogo truncado]";
  }

  return {
    brief,
    briefChars: brief.length,
    usedFullDbga: false,
    narrativeChars: narrative.length,
    signalsChars: signals.length,
  };
}

/**
 * Builds a compact DBGA brief for Clarifier input.
 * Returns full DBGA when already under budget.
 */
export function buildClarifierDbgaBrief(params: BuildClarifierDbgaBriefParams): ClarifierDbgaBriefResult {
  const dbga = (params.dbgaContent ?? "").trim();
  const maxChars = params.maxChars ?? resolveClarifierDbgaBriefMaxChars(params.paso0Catalog);

  if (!dbga) {
    return { brief: "", briefChars: 0, usedFullDbga: true, narrativeChars: 0, signalsChars: 0 };
  }

  if (params.paso0Catalog) {
    if (dbga.length <= maxChars) {
      const catalogBlock = formatPaso0CatalogSummaryBlock(params.paso0Catalog, 8_000);
      const guardBlock = formatPaso0CatalogGuardBlock(params.paso0Catalog, 4_000);
      const combined = `${catalogBlock}\n\n---\n\n${guardBlock}\n\n---\n\n${dbga}`;
      if (combined.length <= maxChars) {
        return {
          brief: combined,
          briefChars: combined.length,
          usedFullDbga: true,
          narrativeChars: dbga.length,
          signalsChars: 0,
        };
      }
    }
    return buildPaso0PastedBrief(dbga, params.paso0Catalog, maxChars);
  }

  if (dbga.length <= maxChars) {
    return {
      brief: dbga,
      briefChars: dbga.length,
      usedFullDbga: true,
      narrativeChars: dbga.length,
      signalsChars: 0,
    };
  }

  const sections = extractH2Sections(dbga);
  const h3Signals = extractH3Signals(dbga);
  const narrative = buildNarrativeHead(sections, NARRATIVE_BUDGET_CHARS);
  const signals = buildStructuralSignals(sections, h3Signals, SIGNALS_BUDGET_CHARS);

  const parts = [
    "**DBGA (extracto — fidelidad al benchmark; inventario de dominio aparte):**",
    narrative,
    signals,
  ].filter(Boolean);

  let brief = parts.join("\n\n").trim();
  if (brief.length > maxChars) {
    brief = brief.slice(0, maxChars) + "\n…[DBGA extracto truncado]";
  }

  return {
    brief,
    briefChars: brief.length,
    usedFullDbga: false,
    narrativeChars: narrative.length,
    signalsChars: signals.length,
  };
}

/** Inventory block sized for Clarifier (KMS-scale). */
export function formatClarifierDomainInventory(
  inventory: DomainInventory,
  paso0Catalog?: Paso0DecisionCatalog | null,
): string {
  return formatDomainInventoryForPrompt(inventory, 4_800, paso0Catalog ?? null);
}

/**
 * Source text for §1 hydration when LLM draft is insubstantial.
 * Prefers clarifiedScope; falls back to DBGA brief (not blind slice).
 */
export function buildDbgaHydrationSource(params: {
  clarifiedScope: string;
  dbgaContent: string;
  minScopeLen?: number;
  maxHydrationChars?: number;
}): string {
  const scope = (params.clarifiedScope ?? "").trim();
  const minScopeLen = params.minScopeLen ?? 200;
  const maxChars = params.maxHydrationChars ?? 12_000;

  if (scope.length >= minScopeLen) {
    return scope.length <= maxChars ? scope : scope.slice(0, maxChars);
  }

  const { brief } = buildClarifierDbgaBrief({
    dbgaContent: params.dbgaContent,
    maxChars: Math.min(maxChars, DEFAULT_CLARIFIER_DBGA_BRIEF_MAX_CHARS),
  });
  const fallback = brief || (params.dbgaContent ?? "").trim();
  const normalized = demoteHeadingsForSection1Embed(fallback);
  return normalized.length <= maxChars ? normalized : normalized.slice(0, maxChars);
}
