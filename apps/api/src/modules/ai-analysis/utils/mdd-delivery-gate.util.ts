import type { MddDeliveryGateResult } from "@theforge/shared-types";
import { preRenderMddSanity } from "./mdd-pre-render.js";
import {
  detectCrossConsistencyIssues,
  detectDuplicateUatSections,
  detectUnclosedSqlFences,
  validateMddStructure,
} from "./mdd-sanitize.js";

export type { MddDeliveryGateResult };

const DELIVERY_SCORE_THRESHOLD = 90;

/** Heurística alineada con reconcileUiUxDesignIntent: columnas id,name,status repetidas. */
function detectGenericUiUxIntent(draft: string): boolean {
  if (!/##\s*UI\/UX\s+Design\s+Intent/i.test(draft)) return false;
  return (draft.match(/\bid,\s*name,\s*status\b/g) ?? []).length >= 4;
}

/**
 * Gate bloqueante de entrega MDD (Fase 0 ≥9/10).
 * ok=true solo si score >= 90 y blockers.length === 0.
 */
export function validateMddForDelivery(draft: string): MddDeliveryGateResult {
  const trimmed = (draft ?? "").trim();
  const blockers: string[] = [];
  const warnings: string[] = [];
  let score = 100;

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

  const consistencyIssues = detectCrossConsistencyIssues(trimmed);
  blockers.push(...consistencyIssues);

  const sanity = preRenderMddSanity(trimmed);
  if (!sanity.ok) {
    blockers.push(sanity.message ?? sanity.code ?? "Error de validación pre-render del MDD.");
  }

  if (detectDuplicateUatSections(trimmed)) {
    warnings.push("§1 y §5 duplican criterios UAT; consolidar referencia en §1.");
    score -= 5;
  }

  if (detectGenericUiUxIntent(trimmed)) {
    warnings.push(
      "UI/UX Design Intent usa columnas genéricas repetidas (id, name, status); regenerar desde §3.",
    );
    score -= 10;
  }

  score -= blockers.length * 8;
  score = Math.max(0, Math.min(100, score));

  const ok = score >= DELIVERY_SCORE_THRESHOLD && blockers.length === 0;
  return { ok, score, blockers, warnings };
}

/** Ajusta semáforo en vivo cuando el gate de entrega no aprueba el MDD. */
export function applyDeliveryGateToSemaphoreStatus(
  status: "red" | "yellow" | "green",
  gate: MddDeliveryGateResult,
): "red" | "yellow" | "green" {
  if (gate.ok) return status;
  return gate.blockers.length > 0 ? "red" : "yellow";
}

/** Campos SSE compartidos (done/draft/interrupt) a partir del gate y métricas. */
export function mddStreamDeliveryGateFields(
  gate: MddDeliveryGateResult | undefined,
  metricsStatus: "red" | "yellow" | "green",
): { deliveryGate?: MddDeliveryGateResult; status: "red" | "yellow" | "green" } {
  if (!gate) return { status: metricsStatus };
  return {
    deliveryGate: {
      ok: gate.ok,
      score: gate.score,
      blockers: gate.blockers,
      warnings: gate.warnings,
    },
    status: applyDeliveryGateToSemaphoreStatus(metricsStatus, gate),
  };
}

export type PersistedMddDeliveryGate = MddDeliveryGateResult & { updatedAt: string };

/** Lee snapshot persistido en `Stage.shortTermContext.deliveryGate`. */
export function readDeliveryGateSnapshot(shortTermContext: unknown): PersistedMddDeliveryGate | null {
  if (!shortTermContext || typeof shortTermContext !== "object" || Array.isArray(shortTermContext)) {
    return null;
  }
  const gate = (shortTermContext as Record<string, unknown>).deliveryGate;
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) return null;
  const g = gate as Record<string, unknown>;
  if (typeof g.ok !== "boolean" || typeof g.score !== "number") return null;
  return {
    ok: g.ok,
    score: g.score,
    blockers: Array.isArray(g.blockers)
      ? g.blockers.filter((b): b is string => typeof b === "string")
      : [],
    warnings: Array.isArray(g.warnings)
      ? g.warnings.filter((w): w is string => typeof w === "string")
      : [],
    updatedAt: typeof g.updatedAt === "string" ? g.updatedAt : "",
  };
}

/** Fusiona gate en shortTermContext sin borrar otras claves (p. ej. mddAuditSnapshot). */
export function mergeDeliveryGateIntoShortTermContext(
  prev: Record<string, unknown>,
  gate: MddDeliveryGateResult,
): Record<string, unknown> {
  return {
    ...prev,
    deliveryGate: {
      ok: gate.ok,
      score: gate.score,
      blockers: gate.blockers,
      warnings: gate.warnings,
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Lightweight: true si validateMddForDelivery reportaría blockers (sin recalcular score). */
export function mddDeliveryGateHasBlockers(draft: string): boolean {
  const trimmed = (draft ?? "").trim();
  if (!trimmed) return true;

  const structure = validateMddStructure(trimmed);
  if (structure.missingSections.length > 0 || !structure.hasTechnicalMetadata) return true;
  if (detectUnclosedSqlFences(trimmed)) return true;
  if (detectCrossConsistencyIssues(trimmed).length > 0) return true;
  if (!preRenderMddSanity(trimmed).ok) return true;
  return false;
}
