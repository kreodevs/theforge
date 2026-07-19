import type { MddDeliveryGateResult } from "@theforge/shared-types";
import { isAutoRepairableDeliveryGateWarning } from "../../engine/mdd-quality-audit.util.js";
import { getSection6Or7Range } from "./mdd-sanitize.js";

/** Máximo de reintentos automáticos del gate de entrega (Fase 4). */
export const MAX_MDD_DELIVERY_GATE_ATTEMPTS = 3;

export type DeliveryGateFixTarget = "software_architect" | "integration" | "clarifier";

const INTEGRATION_BLOCKER_RE =
  /§7|infraestructura|jwt|manifest|node:|microservicios|hashing_algorithm|jwks|api_prefix|tabla\s+outbox\b/i;
const SECTION3_BLOCKER_RE =
  /§3|§4|sql|prosa inválida|create table|erdiagram|technicalmetadata|outbox-like|§6 menciona tabla|fences desbalanceados|tabla huérfana|json inválido/i;
const CLARIFIER_BLOCKER_RE =
  /§1\s*contexto|1\.\s*contexto|secciones obligatorias faltantes|placeholder.*guiones|objetivos comerciales/i;

/** Decide si el siguiente paso del auto-loop debe ser arquitecto (§3/§4), integración (§7) o clarifier (§1). */
export function resolveDeliveryGateFixTarget(blockers: string[]): DeliveryGateFixTarget {
  const items = blockers.length > 0 ? blockers : [];
  const text = items.join(" ");
  let integrationScore = 0;
  let architectScore = 0;
  let clarifierScore = 0;
  for (const b of items) {
    if (INTEGRATION_BLOCKER_RE.test(b)) integrationScore++;
    if (SECTION3_BLOCKER_RE.test(b)) architectScore++;
    if (CLARIFIER_BLOCKER_RE.test(b)) clarifierScore++;
  }
  if (clarifierScore > 0 && clarifierScore >= architectScore && clarifierScore >= integrationScore) {
    return "clarifier";
  }
  if (integrationScore > architectScore) return "integration";
  if (architectScore > integrationScore) return "software_architect";
  return INTEGRATION_BLOCKER_RE.test(text) ? "integration" : "software_architect";
}

/** Issues del gate que siguen tras auto-reparación — disparan loop de agentes, no bloquean al usuario. */
export function hasUnresolvedAutoRepairableGateWarnings(warnings: string[]): boolean {
  return warnings.some((w) => isAutoRepairableDeliveryGateWarning(w));
}

/** @deprecated Use hasUnresolvedAutoRepairableGateWarnings */
export function hasUnresolvedAutoRepairableQuality(warnings: string[]): boolean {
  return hasUnresolvedAutoRepairableGateWarnings(warnings);
}

/** Feedback en español para agentes en el auto-loop del gate (no se muestra crudo al usuario). */
export function formatDeliveryGateBlockersFeedback(blockers: string[]): string {
  const items = blockers.filter((b) => b.trim().length > 0);
  if (items.length === 0) return "";
  const header =
    "Gate de entrega MDD — corrige automáticamente estos defectos estructurales antes de finalizar:";
  return `${header}\n${items.map((b) => `- ${b}`).join("\n")}`;
}

/** Feedback para agentes a partir de warnings auto-reparables del gate. */
export function formatDeliveryGateQualityWarningsFeedback(warnings: string[]): string {
  const items = warnings.filter((w) => isAutoRepairableDeliveryGateWarning(w));
  if (items.length === 0) return "";
  const header =
    "Gate MDD — reparar automáticamente (coherencia §1–§7, SQL, Mermaid, metadata):";
  return `${header}\n${items.map((w) => `- ${w}`).join("\n")}`;
}

export function draftHasSubstantialSection7(draft: string): boolean {
  const range = getSection6Or7Range((draft ?? "").trim(), 7);
  if (!range) return false;
  const body = draft
    .slice(range.start + range.heading.length, range.end)
    .replace(/^\s*\n+/, "")
    .trim();
  return body.length > 200 && !/^\s*\(Pendiente[^)]*\)\s*$/im.test(body);
}

/** True si §6 y §7 tienen contenido sustancial (saltar re-ejecución en reintentos del gate). */
export function draftHasSubstantialSections6And7(draft: string): boolean {
  const range6 = getSection6Or7Range((draft ?? "").trim(), 6);
  if (!range6) return false;
  const body6 = draft
    .slice(range6.start + range6.heading.length, range6.end)
    .replace(/^\s*\n+/, "")
    .trim();
  const has6 = body6.length > 200 && !/^\s*\(Pendiente[^)]*\)\s*$/im.test(body6);
  return has6 && draftHasSubstantialSection7(draft);
}

export function shouldContinueDeliveryGateLoop(
  gate: MddDeliveryGateResult | undefined,
  attempt: number,
): boolean {
  if (!gate || gate.ok) return false;
  return attempt < MAX_MDD_DELIVERY_GATE_ATTEMPTS;
}
