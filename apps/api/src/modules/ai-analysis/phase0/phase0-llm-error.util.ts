import {
  isModelExhaustionError,
  MODELS_UNAVAILABLE_CODE,
  MODELS_UNAVAILABLE_MESSAGE,
  ModelsUnavailableError,
} from "../../ai/config/llm-model-fallback.js";
import type { Phase0StreamEvent } from "./phase0.types.js";

const LLM_PROVIDER_SETUP_MESSAGE =
  "No se pudo usar el modelo de IA. Configura un proveedor y un modelo en Ajustes → Gestionar instancias.";

const LLM_QUOTA_MESSAGE =
  "Has alcanzado el límite de uso o créditos del proveedor de IA. Revisa tu saldo en el proveedor o elige otro modelo en Ajustes → Gestionar instancias.";

/** Maps LLM / BYOK failures to a Phase0 stream error (never silently completes). */
export function toPhase0ErrorEvent(err: unknown): Phase0StreamEvent {
  if (err instanceof ModelsUnavailableError) {
    return {
      type: "error",
      message: err.message || MODELS_UNAVAILABLE_MESSAGE,
      code: MODELS_UNAVAILABLE_CODE,
    };
  }
  if (isModelExhaustionError(err)) {
    return {
      type: "error",
      message: LLM_QUOTA_MESSAGE,
      code: MODELS_UNAVAILABLE_CODE,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg && isModelExhaustionError(new Error(msg))) {
    return {
      type: "error",
      message: LLM_QUOTA_MESSAGE,
      code: MODELS_UNAVAILABLE_CODE,
    };
  }
  return {
    type: "error",
    message: msg.trim() || "No se pudo completar la entrevista de Fase 0",
  };
}

export function phase0ProviderUnavailableEvent(): Phase0StreamEvent {
  return {
    type: "error",
    message: LLM_PROVIDER_SETUP_MESSAGE,
    code: MODELS_UNAVAILABLE_CODE,
  };
}

/** True when fallback questions must not mark Fase 0 as done (quota, no model, etc.). */
export function isPhase0FatalLlmError(err: unknown): boolean {
  if (err instanceof ModelsUnavailableError) return true;
  if (isModelExhaustionError(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return Boolean(msg && isModelExhaustionError(new Error(msg)));
}
