/**
 * @fileoverview Pricing por millón de tokens (USD) para modelos de chat.
 *
 * Snapshot manual del catálogo de OpenRouter / OpenAI / Anthropic / Google / Groq / Cloudflare.
 * Se usa como fallback cuando el proveedor / modelo no expone `usage.cost` directamente.
 *
 * Para añadir un modelo nuevo: añade entrada `(providerId, modelId)` → `{ input, output }`
 * en USD por millón de tokens. Si el modelo no aparece, `resolveChatModelPricing` devuelve
 * `null` y el cálculo de coste devolverá 0 (sin error).
 *
 * TODO: cuando se integre FX live, este módulo expone `MXN_PER_USD` como constante por
 * compatibilidad con `mdd-ia-cost-reference.ts` y `estimation.types.ts`. Ver bloque inferior.
 */

export const MXN_PER_USD = 20;

export interface ChatModelPricing {
  /** USD por millón de tokens de entrada. */
  input: number;
  /** USD por millón de tokens de salida. */
  output: number;
  /** Fuente del precio (catálogo OpenRouter, OpenAI directa, etc.) para auditoría. */
  source?: string;
  /** Fecha de captura (ISO 8601). Útil para stale-checks futuros. */
  capturedAt?: string;
}

/**
 * Tabla interna `(providerId|modelId) → pricing`. Para OpenRouter la clave es
 * `openrouter:<modelId>` (con prefijo `openai/`, `anthropic/`, etc.). Para proveedores
 * directos la clave es `providerId:modelId` (sin prefijo).
 *
 * Precios en USD por 1M tokens. Última revisión: 2026-07-24.
 */
const CHAT_MODEL_PRICING: Record<string, ChatModelPricing> = {
  // ─────────────────────────────────────────────────────────────
  // OpenRouter (slugs con prefijo de proveedor upstream)
  // ─────────────────────────────────────────────────────────────
  "openrouter:openai/gpt-4o": {
    input: 2.5,
    output: 10,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:openai/gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:openai/gpt-4.1": {
    input: 2,
    output: 8,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:openai/o1": {
    input: 15,
    output: 60,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:openai/o1-pro": {
    input: 150,
    output: 600,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:anthropic/claude-sonnet-4": {
    input: 3,
    output: 15,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:anthropic/claude-opus-4": {
    input: 15,
    output: 75,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:anthropic/claude-3-5-sonnet-20240620": {
    input: 3,
    output: 15,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:anthropic/claude-3-5-haiku-20241022": {
    input: 0.8,
    output: 4,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:google/gemini-2.5-pro": {
    input: 1.25,
    output: 10,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:google/gemini-2.5-flash": {
    input: 0.3,
    output: 2.5,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:google/gemini-2.0-flash": {
    input: 0.1,
    output: 0.4,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:meta-llama/llama-3.3-70b-instruct": {
    input: 0.59,
    output: 0.79,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:minimax/minimax-m3": {
    input: 0.2,
    output: 0.8,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },
  "openrouter:minimax/minimax-m3:nitro": {
    input: 0.05,
    output: 0.2,
    source: "openrouter",
    capturedAt: "2026-07-24",
  },

  // ─────────────────────────────────────────────────────────────
  // OpenAI directo
  // ─────────────────────────────────────────────────────────────
  "openai:gpt-4o": { input: 2.5, output: 10, source: "openai" },
  "openai:gpt-4o-mini": { input: 0.15, output: 0.6, source: "openai" },
  "openai:gpt-4.1": { input: 2, output: 8, source: "openai" },
  "openai:gpt-4.1-mini": { input: 0.4, output: 1.6, source: "openai" },
  "openai:o1": { input: 15, output: 60, source: "openai" },
  "openai:o1-pro": { input: 150, output: 600, source: "openai" },
  "openai:gpt-4.1-nano": { input: 0.1, output: 0.4, source: "openai" },
  "openai:gpt-3.5-turbo": { input: 0.5, output: 1.5, source: "openai" },

  // ─────────────────────────────────────────────────────────────
  // Anthropic directo
  // ─────────────────────────────────────────────────────────────
  "anthropic:claude-sonnet-4-20250514": {
    input: 3,
    output: 15,
    source: "anthropic",
  },
  "anthropic:claude-opus-4-20250514": {
    input: 15,
    output: 75,
    source: "anthropic",
  },
  "anthropic:claude-3-5-sonnet-20240620": {
    input: 3,
    output: 15,
    source: "anthropic",
  },
  "anthropic:claude-3-5-haiku-20241022": {
    input: 0.8,
    output: 4,
    source: "anthropic",
  },
  "anthropic:claude-3-opus-20240229": {
    input: 15,
    output: 75,
    source: "anthropic",
  },
  "anthropic:claude-3-haiku-20240307": {
    input: 0.25,
    output: 1.25,
    source: "anthropic",
  },

  // ─────────────────────────────────────────────────────────────
  // Google Gemini directo
  // ─────────────────────────────────────────────────────────────
  "gemini:gemini-2.5-pro": { input: 1.25, output: 10, source: "google" },
  "gemini:gemini-2.5-flash": { input: 0.3, output: 2.5, source: "google" },
  "gemini:gemini-2.0-flash": { input: 0.1, output: 0.4, source: "google" },
  "gemini:gemini-2.0-flash-lite": { input: 0.075, output: 0.3, source: "google" },
  "gemini:gemini-1.5-pro": { input: 1.25, output: 5, source: "google" },
  "gemini:gemini-1.5-flash": { input: 0.075, output: 0.3, source: "google" },

  // ─────────────────────────────────────────────────────────────
  // Groq (inferencia rápida)
  // ─────────────────────────────────────────────────────────────
  "groq:llama-3.3-70b-versatile": {
    input: 0.59,
    output: 0.79,
    source: "groq",
  },
  "groq:llama-3.1-8b-instant": {
    input: 0.05,
    output: 0.08,
    source: "groq",
  },
  "groq:openai/gpt-oss-120b": {
    input: 0.15,
    output: 0.6,
    source: "groq",
  },

  // ─────────────────────────────────────────────────────────────
  // Cloudflare Workers AI
  // ─────────────────────────────────────────────────────────────
  "cloudflare:@cf/meta/llama-3.3-70b-instruct-fp8-fast": {
    input: 0.59,
    output: 0.79,
    source: "cloudflare",
  },
  "cloudflare:@cf/meta/llama-3.1-8b-instruct": {
    input: 0.05,
    output: 0.08,
    source: "cloudflare",
  },
};

/**
 * Resuelve el pricing para un par (providerId, modelId). OpenRouter recibe modelo
 * con prefijo upstream (`openai/gpt-4o`, `anthropic/claude-sonnet-4`, etc.); proveedores
 * directos lo reciben sin prefijo.
 *
 * Devuelve `null` si el modelo no está catalogado — en ese caso el cálculo de coste
 * resultará 0 USD/MXN (no es un error).
 */
export function resolveChatModelPricing(
  providerId: string,
  modelId: string,
): ChatModelPricing | null {
  const key = `${providerId}:${modelId}`;
  const direct = CHAT_MODEL_PRICING[key];
  if (direct) return direct;

  // OpenRouter: intentar también la versión con prefijo upstream (`openai/gpt-4o` ya entra directo).
  // Si llega un slug sin prefijo upstream (raro), buscar en `openrouter:<modelId>`.
  if (providerId === "openrouter") {
    const fallback = CHAT_MODEL_PRICING[`openrouter:${modelId}`];
    if (fallback) return fallback;
  }

  return null;
}

/**
 * Calcula coste USD para un call dado. Si no hay pricing, devuelve 0.
 */
export function calculateChatCostUsd(
  providerId: string,
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = resolveChatModelPricing(providerId, modelId);
  if (!pricing) return 0;
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return roundUsd(inputCost + outputCost);
}

/**
 * Convierte USD a MXN usando la constante estática. Para live FX, ver TODO en el header.
 */
export function usdToMxn(usd: number): number {
  return roundUsd(usd * MXN_PER_USD);
}

/**
 * Helper público para tests: registra un override de pricing en runtime (no persiste).
 * Útil para inyectar precios custom cuando el usuario define el suyo en
 * `ProviderInstance` (futuro).
 */
export function registerChatModelPricingOverride(
  providerId: string,
  modelId: string,
  pricing: ChatModelPricing,
): void {
  CHAT_MODEL_PRICING[`${providerId}:${modelId}`] = pricing;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
