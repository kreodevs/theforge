import type { MddDeliveryGateResult } from "@theforge/shared-types";
import { isAutoRepairableDeliveryGateWarning } from "../../engine/mdd-quality-audit.util.js";
import { getSection6Or7Range } from "./mdd-sanitize.js";

/** Máximo de reintentos automáticos del gate de entrega (Fase 4). */
export const MAX_MDD_DELIVERY_GATE_ATTEMPTS = 3;

/** Nodo del grafo al que el auto-loop redirige tras un fallo del gate.
 *  - "software_architect": re-genera §2/§3/§4/§5 (slice completo, LOW/MEDIUM).
 *  - "stack_architect" | "data_model" | "api_contracts": pipeline HIGH acotado.
 *  - "integration": re-genera §6/§7 en paralelo.
 *  - "clarifier": re-pide alcance al usuario.
 *  - "section5": re-genera SOLO §5 (cuando el substance check falla
 *    únicamente en §5, evita re-correr todo el software_architect).
 *    CHANGELOG [Unreleased] → Added → "Dedicated §5 pass". */
export type DeliveryGateFixTarget =
  | "software_architect"
  | "stack_architect"
  | "data_model"
  | "api_contracts"
  | "integration"
  | "clarifier"
  | "section5";

export type ResolveDeliveryGateFixTargetOptions = {
  /** Pipeline HIGH §2→§3→§4: enruta al nodo acotado según blockers. */
  splitArchitectPipeline?: boolean;
};

const SECTION5_BLOCKER_RE = /5\.\s*Lógica\s+y\s*Edge\s+Cases/i;
const INTEGRATION_BLOCKER_RE =
  /§7|infraestructura|jwt|manifest|node:|microservicios|hashing_algorithm|jwks|api_prefix|tabla\s+outbox\b/i;
const SECTION2_BLOCKER_RE =
  /§2|2\.\s*arquitectura|stack\b|frontend|backend|orm\b/i;
const SECTION3_BLOCKER_RE =
  /§3|sql|prosa inválida|create table|erdiagram|technicalmetadata|outbox-like|§6 menciona tabla|fences desbalanceados|tabla huérfana|json inválido|domain-auth-only|domain-entities|domain-dbga|modelo de datos/i;
const SECTION4_BLOCKER_RE =
  /§4|contratos de api|endpoints reales|request\/response|domain-section4/i;
// §1 substance: el Clarifier debe re-pedir el alcance al usuario. §2 también
// si falta el stack (heading ausente); pero §2 con heading presente y
// body corto es un problema del Architect, no del Clarifier. Para distinguir,
// exigimos que el mensaje de §2 mencione "faltante" o "faltantes".
const CLARIFIER_BLOCKER_RE =
  /§1\s*contexto|1\.\s*contexto|2\.\s*arquitectura\s+y\s*stack\s*faltant|secciones obligatorias faltantes:.*(?:1\.\s*contexto|2\.\s*arquitectura)|placeholder.*guiones|objetivos comerciales/i;

const MISSING_SECTION7_BLOCKER_RE =
  /secciones obligatorias faltantes:\s*7\.\s*infraestructura\b/i;

/** Decide si el siguiente paso del auto-loop debe ser arquitecto (§3/§4), integración (§7),
 *  clarifier (§1) o section5 (§5 sólo). Prioriza el match más específico:
 *  si el substance check sólo menciona §5, enruta a "section5" (más eficiente
 *  que re-correr software_architect). */
function resolveSplitArchitectFixTarget(items: string[]): DeliveryGateFixTarget {
  let stackScore = 0;
  let dataScore = 0;
  let apiScore = 0;
  for (const b of items) {
    if (SECTION4_BLOCKER_RE.test(b)) apiScore++;
    else if (SECTION3_BLOCKER_RE.test(b)) dataScore++;
    else if (SECTION2_BLOCKER_RE.test(b)) stackScore++;
  }
  if (apiScore > 0 && apiScore >= dataScore && apiScore >= stackScore) return "api_contracts";
  if (dataScore > 0 && dataScore >= stackScore) return "data_model";
  if (stackScore > 0) return "stack_architect";
  return "data_model";
}

export function resolveDeliveryGateFixTarget(
  blockers: string[],
  options?: ResolveDeliveryGateFixTargetOptions,
): DeliveryGateFixTarget {
  const items = blockers.length > 0 ? blockers : [];
  const text = items.join(" ");

  // Prioridad alta: si TODOS los blockers son sólo sobre §5 → section5
  // (más eficiente que regenerar §2-§5 vía software_architect).
  if (items.length > 0 && items.every((b) => SECTION5_BLOCKER_RE.test(b))) {
    return "section5";
  }

  if (items.some((b) => MISSING_SECTION7_BLOCKER_RE.test(b))) {
    return "integration";
  }

  let integrationScore = 0;
  let architectScore = 0;
  let clarifierScore = 0;
  for (const b of items) {
    if (INTEGRATION_BLOCKER_RE.test(b)) integrationScore++;
    if (SECTION3_BLOCKER_RE.test(b) || SECTION4_BLOCKER_RE.test(b) || SECTION2_BLOCKER_RE.test(b)) {
      architectScore++;
    }
    if (CLARIFIER_BLOCKER_RE.test(b)) clarifierScore++;
  }
  if (clarifierScore > 0 && clarifierScore >= architectScore && clarifierScore >= integrationScore) {
    return "clarifier";
  }
  if (integrationScore > architectScore) return "integration";
  if (architectScore > integrationScore) {
    return options?.splitArchitectPipeline
      ? resolveSplitArchitectFixTarget(items)
      : "software_architect";
  }
  if (options?.splitArchitectPipeline && architectScore > 0) {
    return resolveSplitArchitectFixTarget(items);
  }
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
