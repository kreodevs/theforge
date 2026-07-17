import type { MddDeliveryGateResult } from "@theforge/shared-types";
import { extractSection3Body, getSection6Or7Range } from "./mdd-sanitize.js";

/** Máximo de reintentos automáticos del gate de entrega (Fase 4). */
export const MAX_MDD_DELIVERY_GATE_ATTEMPTS = 3;

export type DeliveryGateFixTarget = "software_architect" | "integration";

const INTEGRATION_BLOCKER_RE =
  /§7|infraestructura|jwt|manifest|node:|microservicios|hashing_algorithm|jwks|api_prefix|tabla\s+outbox\b/i;
const SECTION3_BLOCKER_RE =
  /§3|sql|prosa inválida|create table|erdiagram|technicalmetadata|outbox-like|§6 menciona tabla/i;

/** Decide si el siguiente paso del auto-loop debe ser arquitecto (§3) o integración (§7). */
export function resolveDeliveryGateFixTarget(blockers: string[]): DeliveryGateFixTarget {
  const text = blockers.join(" ");
  let integrationScore = 0;
  let architectScore = 0;
  for (const b of blockers) {
    if (INTEGRATION_BLOCKER_RE.test(b)) integrationScore++;
    if (SECTION3_BLOCKER_RE.test(b)) architectScore++;
  }
  if (integrationScore > architectScore) return "integration";
  if (architectScore > integrationScore) return "software_architect";
  return INTEGRATION_BLOCKER_RE.test(text) ? "integration" : "software_architect";
}

/** Feedback en español para agentes en el auto-loop del gate. */
export function formatDeliveryGateBlockersFeedback(blockers: string[]): string {
  if (blockers.length === 0) return "";
  const header =
    "Gate de entrega MDD bloqueado — corrige automáticamente estos defectos antes de finalizar:";
  return `${header}\n${blockers.map((b) => `- ${b}`).join("\n")}`;
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

/** True si §2–§5 tienen contenido sustancial (evitar re-ejecutar architect en corrección mixta). */
export function draftHasSubstantialArchitectSections(draft: string): boolean {
  const trimmed = (draft ?? "").trim();
  const section3 = extractSection3Body(trimmed);
  if ((section3?.length ?? 0) > 200 && /\bCREATE\s+TABLE\b/i.test(section3 ?? "")) {
    return true;
  }
  const architectH2 = (trimmed.match(/^##\s+[1-5]\./gm) ?? []).length;
  return trimmed.length > 800 && architectH2 >= 3;
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
