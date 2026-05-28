/** Debe coincidir con `MODELS_UNAVAILABLE_CODE` del API. */
export const MODELS_UNAVAILABLE_CODE = "MODELS_UNAVAILABLE";

export const MODELS_UNAVAILABLE_MESSAGE =
  "No hay un modelo disponible configurado. Revisa el modelo principal y los respaldos en Ajustes → Gestionar instancias.";

export const LLM_QUOTA_EXCEEDED_MESSAGE =
  "Has alcanzado el límite de uso o créditos del proveedor de IA. Revisa tu saldo en el proveedor o elige otro modelo en Ajustes → Gestionar instancias.";

export function isLlmQuotaExceededMessage(message?: string): boolean {
  const msg = (message ?? "").trim().toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("insufficient_quota") ||
    msg.includes("insufficient quota") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests") ||
    msg.includes("resource exhausted") ||
    msg.includes("resource_exhausted") ||
    msg.includes("free-models-per-day") ||
    msg.includes("free model requests") ||
    msg.includes("límite de uso") ||
    msg.includes("créditos del proveedor")
  );
}

export function isModelsUnavailableStreamError(event: {
  message?: string;
  code?: string;
}): boolean {
  if (event.code === MODELS_UNAVAILABLE_CODE) return true;
  const msg = (event.message ?? "").trim();
  return (
    msg.includes("No hay un modelo disponible configurado") ||
    msg.includes("No se pudo usar el modelo de IA") ||
    msg.includes("No se pudo configurar el modelo LLM") ||
    /not a valid model id/i.test(msg) ||
    /no endpoints found for/i.test(msg)
  );
}

/** User-facing copy for Phase 0 / stream payloads with type error. */
export function resolvePhase0ErrorMessage(event: {
  message?: string;
  code?: string;
}): string {
  if (isModelsUnavailableStreamError(event)) {
    return MODELS_UNAVAILABLE_MESSAGE;
  }
  if (isLlmQuotaExceededMessage(event.message)) {
    return LLM_QUOTA_EXCEEDED_MESSAGE;
  }
  const msg = (event.message ?? "").trim();
  return msg || "No se pudo completar la entrevista de Fase 0";
}
