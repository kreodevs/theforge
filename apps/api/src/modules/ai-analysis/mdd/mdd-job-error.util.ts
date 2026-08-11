import { UnrecoverableError } from "bullmq";
import { BadRequestException } from "@nestjs/common";
import { MDD_DELIVERY_GATE_ERR } from "../utils/mdd-delivery-gate-guard.util.js";

const USER_CANCEL_MESSAGE = "Cancelado por el usuario";

export function isMddUserCancellationError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes(USER_CANCEL_MESSAGE) ||
    msg.includes("Cancelado por el administrador") ||
    /\b(aborted|abort)\b/i.test(msg)
  );
}

/** Persist gate falló tras pipeline OK — no reintentar todo el grafo (job 123). */
export function isMddPersistOnlyGateError(err: unknown): boolean {
  if (!(err instanceof BadRequestException)) return false;
  const response = err.getResponse();
  if (!response || typeof response !== "object") return false;
  const code = (response as { code?: string }).code;
  return code === MDD_DELIVERY_GATE_ERR;
}

/** Errores de cuota/límite del proveedor LLM — no reintentar pipeline completo. */
export function isMddLlmQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b403\b/.test(msg) &&
    /key limit|insufficient credits|quota exceeded|rate limit|billing/i.test(msg)
  );
}

/** Evita reintentos BullMQ tras cancelación (preserva threadId / checkpoint LangGraph). */
export function toMddJobError(err: unknown): Error {
  if (isMddUserCancellationError(err)) {
    const message = err instanceof Error ? err.message : String(err);
    return new UnrecoverableError(message);
  }
  if (isMddPersistOnlyGateError(err)) {
    const message = err instanceof Error ? err.message : String(err);
    return new UnrecoverableError(message);
  }
  if (isMddLlmQuotaError(err)) {
    const message = err instanceof Error ? err.message : String(err);
    return new UnrecoverableError(`OpenRouter/cuota LLM agotada — ${message}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}
