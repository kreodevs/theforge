import type { MddDeliveryGateResult } from "@theforge/shared-types";
import { prepareMddForOutput } from "./mdd-prepare-output.js";
import { validateMddForDelivery } from "./mdd-delivery-gate.util.js";

export const MDD_DELIVERY_GATE_ERR = "ERR_MDD_DELIVERY_GATE";

/**
 * Evalúa el gate tras el pipeline determinista de prepareMddForOutput (fixes seguros en mdd-sanitize).
 */
export function evaluateMddDeliveryGatePrepared(mddRaw: string): MddDeliveryGateResult {
  const gateRef: { current?: MddDeliveryGateResult } = {};
  prepareMddForOutput(mddRaw, { deliveryGateRef: gateRef });
  return gateRef.current ?? validateMddForDelivery(mddRaw);
}

export type MddDeliveryGateHttpErrorBody = {
  code: typeof MDD_DELIVERY_GATE_ERR;
  message: string;
  deliveryGate: MddDeliveryGateResult;
};

/** Cuerpo de error HTTP 409 para bloqueo de entregables. */
export function buildMddDeliveryGateConflictBody(
  gate: MddDeliveryGateResult,
  fallbackMessage = "El MDD no aprueba el gate de entrega (≥90/100).",
): MddDeliveryGateHttpErrorBody {
  return {
    code: MDD_DELIVERY_GATE_ERR,
    message: gate.blockers.join("; ") || fallbackMessage,
    deliveryGate: gate,
  };
}
