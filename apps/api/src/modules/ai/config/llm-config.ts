/**
 * Utilidades LLM globales (sin claves ni modelos desde env — BYOK por usuario).
 */

export const OPENROUTER_DEFAULT_BASE = "https://openrouter.ai/api/v1";
export const OPENROUTER_DEFAULT_CHAT_MODEL = "nousresearch/hermes-3-llama-3.1-405b";
export const OPENROUTER_DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
/** Referencia de catálogo OpenRouter; el runtime usa `ProviderInstance.visionModel` (BYOK). */
export const OPENROUTER_DEFAULT_VISION_MODEL = "openai/gpt-4o";

/**
 * Tope de tokens de **salida** (`max_tokens` en la API), no ventana de contexto.
 * Default 128K: techo global (`LLM_MAX_TOKENS`); los perfiles por tarea nunca lo superan.
 */
export const LLM_MAX_TOKENS_DEFAULT = 131_072;

/** Perfiles de salida por tipo de tarea (siempre acotados por `llmMaxTokens()`). */
export const LLM_OUTPUT_TOKEN_PROFILES = {
  /** Turnos conversacionales (chat sin regenerar documento). */
  chat: 8_192,
  /** Bienvenida / mensajes cortos. */
  welcome: 2_048,
  /** Design System (DESIGN.md). */
  uxGuide: 16_384,
  /** Documento completo vía Workshop (MDD, DBGA, Blueprint, Spec, BRD…). */
  document: 65_536,
  /** Nodos LangGraph MDD/DBGA (una sección por llamada). */
  langgraph: 16_384,
  /** Auditor MDD / cross-consistency. */
  auditor: 8_192,
  /** Tasks Planner JSON (plan grande en proyectos HIGH). */
  tasksPlanner: 81_920,
  /** Tasks documento markdown completo (Workshop tab). */
  tasksDoc: 131_072,
  /** parseChecklist y salidas JSON cortas. */
  checklist: 4_096,
} as const;

export type LlmOutputTokenPurpose = keyof typeof LLM_OUTPUT_TOKEN_PROFILES;

const WORKSHOP_DOCUMENT_TABS = new Set([
  "mdd",
  "benchmark",
  "spec",
  "brd",
  "blueprint",
  "api-contracts",
  "logic-flows",
  "architecture",
  "use-cases",
  "user-stories",
  "tasks",
  "infra",
  "phase0",
]);

/** Tope global desde env (techo de todos los perfiles). */
export function llmMaxTokens(): number {
  const raw = process.env.LLM_MAX_TOKENS?.trim();
  if (raw === undefined || raw === "") return LLM_MAX_TOKENS_DEFAULT;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000) : LLM_MAX_TOKENS_DEFAULT;
}

/**
 * Resuelve `max_tokens` para una tarea concreta.
 * `explicitOverride` (p. ej. desde `GenerateResponseOptions.maxTokensOverride`) gana sobre el perfil.
 */
export function resolveLlmMaxTokensForPurpose(
  purpose: LlmOutputTokenPurpose = "chat",
  explicitOverride?: number,
): number {
  const ceiling = llmMaxTokens();
  if (explicitOverride != null && Number.isFinite(explicitOverride) && explicitOverride > 0) {
    return Math.min(explicitOverride, ceiling);
  }
  const profile = LLM_OUTPUT_TOKEN_PROFILES[purpose] ?? LLM_OUTPUT_TOKEN_PROFILES.chat;
  return Math.min(profile, ceiling);
}

/** Perfil según pestaña activa del Workshop (chat orquestador / stream). */
export function resolveLlmMaxTokensForWorkshopTab(
  activeTab?: string,
  opts?: { welcomeBrief?: boolean },
): number {
  if (opts?.welcomeBrief) {
    return resolveLlmMaxTokensForPurpose("welcome");
  }
  const tab = activeTab?.trim();
  if (tab === "ux-ui-guide") {
    return resolveLlmMaxTokensForPurpose("uxGuide");
  }
  if (tab === "tasks") {
    return resolveLlmMaxTokensForPurpose("tasksDoc");
  }
  if (tab && WORKSHOP_DOCUMENT_TABS.has(tab)) {
    return resolveLlmMaxTokensForPurpose("document");
  }
  return resolveLlmMaxTokensForPurpose("chat");
}

/**
 * Dimensión de embeddings: preferir runtime BYOK; env solo como fallback de servidor.
 * @deprecated Preferir `runtime.embeddingDimension` desde `resolveEmbeddingRuntime`.
 */
export function resolveEmbeddingDimension(runtimeDim?: number | null): number {
  if (runtimeDim != null && runtimeDim > 0) return runtimeDim;
  const envDim = process.env.OPENAI_EMBEDDING_DIM || process.env.EMBEDDING_DIM;
  const dim = envDim ? parseInt(envDim, 10) : 0;
  if (Number.isFinite(dim) && dim > 0) return dim;
  return 1536;
}

/**
 * LangChain / ChatOpenAI: temperatura fija coherente con el workshop.
 */
export function resolveLangChainChatTemperature(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
    return override;
  }
  return 0.5;
}

/** @deprecated BYOK: sin snapshot desde env */
export function getLlmProvidersSnapshot(): { id: string; chatConfigured: boolean; active: boolean }[] {
  return [];
}

/** Fallback 429 en cadena de modelos (cuando el usuario define chatModelFallbacks en extras). */
export function isChatFallbackOn429Enabled(hasFallbacks = true): boolean {
  if (!hasFallbacks) return false;
  const raw = process.env.OPENROUTER_CHAT_FALLBACK_ON_429?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return true;
}
