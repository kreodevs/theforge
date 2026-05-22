import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import type { ProviderId } from "../../ai/providers/provider-catalog.js";

const PROVIDER_MAP = new WeakMap<BaseChatModel, ProviderId>();
const MODEL_MAP = new WeakMap<BaseChatModel, string>();

const ANTHROPIC_CACHE_MAX_BREAKPOINTS = 4;
const CACHE_MIN_CHARS = 1024;

export function tagLlmProvider(
  llm: BaseChatModel,
  providerId: ProviderId,
  model?: string,
): void {
  PROVIDER_MAP.set(llm, providerId);
  if (model) MODEL_MAP.set(llm, model);
}

export function getLlmProvider(llm: BaseChatModel): ProviderId | null {
  return PROVIDER_MAP.get(llm) ?? null;
}

export function getLlmModel(llm: BaseChatModel): string | null {
  return MODEL_MAP.get(llm) ?? null;
}

function isClaudeModel(model: string | null): boolean {
  if (!model) return false;
  return /claude|anthropic/i.test(model);
}

/**
 * Provider supports Anthropic-style `cache_control: { type: "ephemeral" }` blocks:
 * - anthropic: native
 * - openrouter: pass-through when underlying model is Claude
 */
export function supportsAnthropicCache(llm: BaseChatModel): boolean {
  const providerId = getLlmProvider(llm);
  if (providerId === "anthropic") return true;
  if (providerId === "openrouter") return isClaudeModel(getLlmModel(llm));
  return false;
}

export type CacheableBlock = { text: string; cache?: boolean };

/**
 * Build a HumanMessage with optional Anthropic-style cache breakpoints for cacheable blocks.
 * Falls back to plain text for non-Anthropic providers (OpenAI/Gemini/Groq/Cloudflare use
 * implicit prefix caching when prompt prefix is stable — order cacheable blocks first).
 *
 * Max 4 cache_control breakpoints per Anthropic request; small blocks (<1024 chars) are
 * not worth caching and pass through without cache_control to save a breakpoint.
 */
export function buildCachedHumanMessage(
  llm: BaseChatModel,
  blocks: CacheableBlock[],
): HumanMessage {
  const filtered = blocks.filter((b) => b.text && b.text.length > 0);
  if (!supportsAnthropicCache(llm)) {
    return new HumanMessage(filtered.map((b) => b.text).join("\n\n"));
  }

  let breakpoints = 0;
  const content = filtered.map((b) => {
    const block: { type: "text"; text: string; cache_control?: { type: "ephemeral" } } = {
      type: "text",
      text: b.text,
    };
    if (
      b.cache &&
      b.text.length >= CACHE_MIN_CHARS &&
      breakpoints < ANTHROPIC_CACHE_MAX_BREAKPOINTS
    ) {
      block.cache_control = { type: "ephemeral" };
      breakpoints++;
    }
    return block;
  });
  return new HumanMessage({ content });
}

/**
 * Bind a maxTokens cap to an LLM for a single node call. Uses `.bind({ maxTokens })`
 * when the model supports it; returns the original LLM otherwise. Keeps `bindTools`
 * usable on the returned instance.
 */
export function bindMaxTokens<T extends BaseChatModel>(llm: T, maxTokens: number): T {
  if (typeof (llm as { bind?: unknown }).bind !== "function") return llm;
  try {
    return (llm as unknown as { bind: (opts: Record<string, unknown>) => T }).bind({
      maxTokens,
      max_tokens: maxTokens,
    });
  } catch {
    return llm;
  }
}

/**
 * Hash of MDD structural sections (§3 SQL + §4 endpoints + §7 manifest) to gate
 * cross_consistency LLM call. Returns 0 if no relevant content.
 */
export function hashMddStructuralSections(draft: string): string {
  const s3 = draft.match(/##\s*3\.\s*Modelo[^\n]*[\s\S]*?(?=##\s+\d|\z)/i)?.[0] ?? "";
  const s4 = draft.match(/##\s*4\.\s*Contratos[^\n]*[\s\S]*?(?=##\s+\d|\z)/i)?.[0] ?? "";
  const s7 = draft.match(/##\s*7\.\s*Infraestructura[^\n]*[\s\S]*?(?=##\s+\d|\z)/i)?.[0] ?? "";
  const combined = `${s3}\n${s4}\n${s7}`;
  if (!combined.trim()) return "0";
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return String(hash);
}
