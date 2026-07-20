import type { MddDeliveryGateResult } from "@theforge/shared-types";

export function deliveryGateFromStreamEvent(
  event: { deliveryGate?: MddDeliveryGateResult },
): MddDeliveryGateResult | undefined {
  const gate = event.deliveryGate;
  if (!gate || typeof gate.ok !== "boolean") return undefined;
  return gate;
}

export function formatDeliveryGateInsertBlocker(gate: MddDeliveryGateResult): string {
  const blockers = gate.blockers.filter((b) => b.trim().length > 0);
  if (blockers.length === 0) return "";
  const shown = blockers.slice(0, 2).join(" · ");
  const suffix = blockers.length > 2 ? ` (+${blockers.length - 2} más)` : "";
  return `No se puede guardar: ${shown}${suffix}. Arregla el MDD antes de insertar.`;
}

export function hasDeliveryGateBlockers(gate: MddDeliveryGateResult | null | undefined): boolean {
  return !!gate && !gate.ok && gate.blockers.some((b) => b.trim().length > 0);
}
