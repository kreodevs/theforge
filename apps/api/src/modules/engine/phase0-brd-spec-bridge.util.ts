/**
 * Phase0 (greenfield) → BRD → Spec traceability bridge.
 */

import { loadProjectBorrador } from "../ai-analysis/phase0/phase0-load-borrador.util.js";
import type { Phase0Document } from "../ai-analysis/phase0/phase0.types.js";

export interface Phase0BridgeGap {
  source: "Phase0";
  target: "BRD" | "Spec";
  item: string;
  kind: "entity" | "role" | "flow" | "rule";
  hint: string;
}

export interface Phase0BridgeResult {
  ok: boolean;
  gaps: Phase0BridgeGap[];
  phase0Present: boolean;
}

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function mentionedIn(text: string, label: string): boolean {
  const key = normalizeKey(label);
  if (key.length < 3) return true;
  const words = key.split(/\s+/).filter((w) => w.length > 3);
  const corpus = text.toLowerCase();
  if (corpus.includes(key)) return true;
  if (words.length === 0) return false;
  const hits = words.filter((w) => corpus.includes(w));
  return hits.length >= Math.max(1, Math.ceil(words.length * 0.5));
}

function checkDocAgainstPhase0(
  doc: string,
  target: "BRD" | "Spec",
  borrador: Phase0Document,
): Phase0BridgeGap[] {
  const gaps: Phase0BridgeGap[] = [];
  const corpus = doc.trim();
  if (corpus.length < 80) return gaps;

  for (const ent of borrador.entidades.slice(0, 15)) {
    if (!mentionedIn(corpus, ent.nombre)) {
      gaps.push({
        source: "Phase0",
        target,
        item: ent.nombre,
        kind: "entity",
        hint: `Entidad Phase0 «${ent.nombre}» no aparece en ${target} — documentar en capacidades o entidades de negocio.`,
      });
    }
  }

  for (const rol of borrador.roles.slice(0, 10)) {
    if (!mentionedIn(corpus, rol.rol)) {
      gaps.push({
        source: "Phase0",
        target,
        item: rol.rol,
        kind: "role",
        hint: `Rol Phase0 «${rol.rol}» no aparece en ${target}.`,
      });
    }
  }

  for (const flow of borrador.flujos.slice(0, 8)) {
    if (!mentionedIn(corpus, flow.nombre)) {
      gaps.push({
        source: "Phase0",
        target,
        item: flow.nombre,
        kind: "flow",
        hint: `Flujo Phase0 «${flow.nombre}» no aparece en ${target}.`,
      });
    }
  }

  for (const rule of borrador.reglasNegocio.slice(0, 8)) {
    const snippet = rule.slice(0, 40);
    if (snippet.length > 10 && !mentionedIn(corpus, snippet)) {
      gaps.push({
        source: "Phase0",
        target,
        item: snippet,
        kind: "rule",
        hint: `Regla de negocio Phase0 no reflejada en ${target}: «${snippet}…».`,
      });
    }
  }

  return gaps;
}

/** Validates Phase0 borrador concepts appear in BRD and Spec (greenfield cascade). */
export function checkPhase0BrdSpecBridge(input: {
  dbgaContent?: string | null;
  phase0SummaryContent?: string | null;
  brdContent?: string | null;
  specContent?: string | null;
}): Phase0BridgeResult {
  const borrador = loadProjectBorrador(input.dbgaContent, input.phase0SummaryContent);
  const hasPhase0 =
    borrador.entidades.length > 0 ||
    borrador.roles.length > 0 ||
    borrador.flujos.length > 0 ||
    borrador.reglasNegocio.length > 0;

  if (!hasPhase0) {
    return { ok: true, gaps: [], phase0Present: false };
  }

  const gaps: Phase0BridgeGap[] = [];
  const brd = (input.brdContent ?? "").trim();
  const spec = (input.specContent ?? "").trim();

  if (brd.length >= 80) {
    gaps.push(...checkDocAgainstPhase0(brd, "BRD", borrador));
  } else if (borrador.entidades.length > 0) {
    gaps.push({
      source: "Phase0",
      target: "BRD",
      item: "(documento)",
      kind: "entity",
      hint: "Phase0 tiene entidades definidas pero BRD ausente o muy corto — generar BRD desde DBGA.",
    });
  }

  if (spec.length >= 80) {
    gaps.push(...checkDocAgainstPhase0(spec, "Spec", borrador));
  } else if (borrador.entidades.length > 0) {
    gaps.push({
      source: "Phase0",
      target: "Spec",
      item: "(documento)",
      kind: "entity",
      hint: "Phase0 completo pero Spec ausente — generar Spec antes de cerrar MDD.",
    });
  }

  const seen = new Set<string>();
  const deduped = gaps.filter((g) => {
    const k = `${g.target}|${g.kind}|${g.item}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    ok: deduped.length === 0,
    gaps: deduped.slice(0, 12),
    phase0Present: true,
  };
}

export function formatPhase0BridgeGaps(gaps: Phase0BridgeGap[]): string[] {
  return gaps.map((g) => `[Phase0→${g.target}] ${g.hint}`);
}
