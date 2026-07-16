import type { MddQualityGateGap, MddQualityGateResult, MddDeliveryGateResult } from "@theforge/shared-types";
import { readDeliveryGateSnapshot } from "./mdd-delivery-gate.util.js";
import { domainDeliveryGateFindings } from "../../engine/cascade-accuracy.util.js";
import { preRenderMddSanity } from "./mdd-pre-render.js";
import {
  applyPreDeliveryGateFixes,
  detectCrossConsistencyIssues,
  detectDuplicateUatSections,
  detectUnclosedSqlFences,
  validateMddStructure,
} from "./mdd-sanitize.js";
import { detectSection3CompositionBlockers } from "./schema-owner.util.js";
import {
  computeDeterministicAuditorScore,
  synthesizeDeterministicAuditorGaps,
} from "./mdd-auditor-gaps.util.js";

export type { MddQualityGateGap, MddQualityGateResult };

export type EvaluateMddQualityGateOptions = {
  /** BRD stage content — enables domain auth-skew / entity coverage blockers. */
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
};

export type MddQualityGateDeterministicResult = {
  blockers: string[];
  warnings: string[];
  gaps: MddQualityGateGap[];
};

/** Heurística alineada con reconcileUiUxDesignIntent: columnas id,name,status repetidas. */
function detectGenericUiUxIntent(draft: string): boolean {
  if (!/##\s*UI\/UX\s+Design\s+Intent/i.test(draft)) return false;
  return (draft.match(/\bid,\s*name,\s*status\b/g) ?? []).length >= 4;
}

function auditorGapToQualityGateGap(gap: {
  sections: string[];
  issue: string;
  fix: string;
}): MddQualityGateGap {
  return {
    section: gap.sections[0] ?? "General",
    issue: gap.issue,
    fix: gap.fix,
  };
}

function dedupeBlockers(blockers: string[]): string[] {
  return [...new Set(blockers.filter((b) => b.trim().length > 0))];
}

function dedupeGaps(gaps: MddQualityGateGap[]): MddQualityGateGap[] {
  const seen = new Set<string>();
  const out: MddQualityGateGap[] = [];
  for (const gap of gaps) {
    const key = `${gap.section}::${gap.issue.slice(0, 80)}::${gap.fix.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(gap);
  }
  return out;
}

/**
 * Paso 1 determinista del Quality Gate lean: fusiona delivery gate, auditor gaps,
 * cross-consistency, blockers §3 y hallazgos de dominio (sin umbrales de score).
 */
export function runDeterministicMddQualityGate(
  draft: string,
  options?: EvaluateMddQualityGateOptions,
): MddQualityGateDeterministicResult {
  const trimmed = applyPreDeliveryGateFixes((draft ?? "").trim());
  const blockers: string[] = [];
  const warnings: string[] = [];

  const structure = validateMddStructure(trimmed);
  if (structure.missingSections.length > 0) {
    blockers.push(`Secciones obligatorias faltantes: ${structure.missingSections.join(", ")}`);
  }
  if (!structure.hasTechnicalMetadata) {
    blockers.push(
      "Falta bloque TechnicalMetadata con etiquetas (ej. [high_security]) en §3 Modelo de Datos.",
    );
  }

  const unclosedSql = detectUnclosedSqlFences(trimmed);
  if (unclosedSql) blockers.push(unclosedSql);

  blockers.push(...detectCrossConsistencyIssues(trimmed));
  blockers.push(...detectSection3CompositionBlockers(trimmed));

  const sanity = preRenderMddSanity(trimmed);
  if (!sanity.ok) {
    blockers.push(sanity.message ?? sanity.code ?? "Error de validación pre-render del MDD.");
  }

  if (detectDuplicateUatSections(trimmed)) {
    warnings.push("§1 y §5 duplican criterios UAT; consolidar referencia en §1.");
  }

  if (detectGenericUiUxIntent(trimmed)) {
    warnings.push(
      "UI/UX Design Intent usa columnas genéricas repetidas (id, name, status); regenerar desde §3.",
    );
  }

  if (options?.brdMarkdown?.trim() || options?.dbgaMarkdown?.trim()) {
    const domain = domainDeliveryGateFindings({
      brdMarkdown: options.brdMarkdown,
      dbgaMarkdown: options.dbgaMarkdown,
      mddMarkdown: trimmed,
    });
    blockers.push(...domain.blockers);
    warnings.push(...domain.warnings);
  }

  const score = computeDeterministicAuditorScore(trimmed, structure);
  const auditorGaps = synthesizeDeterministicAuditorGaps(trimmed, structure, score);
  const gaps = auditorGaps.critical_gaps.map(auditorGapToQualityGateGap);
  blockers.push(...auditorGaps.syntax_errors);

  return {
    blockers: dedupeBlockers(blockers),
    warnings: [...new Set(warnings)],
    gaps: dedupeGaps(gaps),
  };
}

/** Paso 3: fusiona determinista + gaps LLM opcionales; `ok` solo si no hay blockers. */
export function buildMddQualityGateResult(
  deterministic: MddQualityGateDeterministicResult,
  llmGaps?: MddQualityGateGap[],
): MddQualityGateResult {
  const gaps = dedupeGaps([...deterministic.gaps, ...(llmGaps ?? [])]);
  const blockers = dedupeBlockers(deterministic.blockers);
  return {
    ok: blockers.length === 0,
    blockers,
    warnings: deterministic.warnings,
    gaps,
  };
}

/** Evalúa el borrador en un solo paso (determinista, sin LLM). */
export function evaluateMddQualityGate(
  draft: string,
  options?: EvaluateMddQualityGateOptions,
): MddQualityGateResult {
  return buildMddQualityGateResult(runDeterministicMddQualityGate(draft, options));
}

/** Lightweight: true si el gate reportaría blockers (sin invocar LLM). */
export function mddQualityGateHasBlockers(draft: string): boolean {
  return runDeterministicMddQualityGate(draft).blockers.length > 0;
}

/** Skip LLM cuando el paso determinista no reporta blockers ni gaps. */
export function shouldSkipLlmQualityGate(deterministic: MddQualityGateDeterministicResult): boolean {
  return deterministic.blockers.length === 0 && deterministic.gaps.length === 0;
}

export type PersistedMddQualityGate = MddQualityGateResult & { updatedAt: string };

/** Convierte Quality Gate lean a formato legacy `deliveryGate` (SSE / entregables). */
export function qualityGateToDeliveryGate(qualityGate: MddQualityGateResult): MddDeliveryGateResult {
  const score = qualityGate.ok ? 100 : Math.max(0, 85 - qualityGate.blockers.length * 5);
  return {
    ok: qualityGate.ok,
    score,
    blockers: qualityGate.blockers,
    warnings: qualityGate.warnings,
  };
}

/** Lee snapshot persistido en `Stage.shortTermContext.qualityGate`. */
export function readQualityGateSnapshot(shortTermContext: unknown): PersistedMddQualityGate | null {
  if (!shortTermContext || typeof shortTermContext !== "object" || Array.isArray(shortTermContext)) {
    return null;
  }
  const gate = (shortTermContext as Record<string, unknown>).qualityGate;
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) return null;
  const g = gate as Record<string, unknown>;
  if (typeof g.ok !== "boolean" || !Array.isArray(g.blockers)) return null;
  const gapsRaw = g.gaps;
  const gaps: MddQualityGateGap[] = Array.isArray(gapsRaw)
    ? gapsRaw
        .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
        .map((item) => ({
          section: typeof item.section === "string" ? item.section : "General",
          issue: typeof item.issue === "string" ? item.issue : "",
          fix: typeof item.fix === "string" ? item.fix : "",
        }))
    : [];
  return {
    ok: g.ok,
    blockers: g.blockers.filter((b): b is string => typeof b === "string"),
    warnings: Array.isArray(g.warnings)
      ? g.warnings.filter((w): w is string => typeof w === "string")
      : [],
    gaps,
    updatedAt: typeof g.updatedAt === "string" ? g.updatedAt : "",
  };
}

/**
 * Lee gate persistido: `qualityGate` primero, fallback a `deliveryGate` legado.
 * Devuelve siempre formato `MddDeliveryGateResult` para APIs existentes.
 */
export function resolveMddGateFromShortTermContext(shortTermContext: unknown): MddDeliveryGateResult | null {
  const quality = readQualityGateSnapshot(shortTermContext);
  if (quality) return qualityGateToDeliveryGate(quality);
  const legacy = readDeliveryGateSnapshot(shortTermContext);
  if (!legacy) return null;
  const { ok, score, blockers, warnings } = legacy;
  return { ok, score, blockers, warnings };
}

/** Fusiona quality gate en shortTermContext sin borrar otras claves (incl. deliveryGate legacy). */
export function mergeQualityGateIntoShortTermContext(
  prev: Record<string, unknown>,
  qualityGate: MddQualityGateResult,
): Record<string, unknown> {
  const deliveryGate = qualityGateToDeliveryGate(qualityGate);
  return {
    ...prev,
    qualityGate: {
      ok: qualityGate.ok,
      blockers: qualityGate.blockers,
      warnings: qualityGate.warnings,
      gaps: qualityGate.gaps,
      updatedAt: new Date().toISOString(),
    },
    deliveryGate: {
      ok: deliveryGate.ok,
      score: deliveryGate.score,
      blockers: deliveryGate.blockers,
      warnings: deliveryGate.warnings,
      updatedAt: new Date().toISOString(),
    },
  };
}
