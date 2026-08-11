/**
 * @fileoverview F6 — streaming scoped del Arquitecto: aborta al 2º heading canónico `## N.`
 * con timeout de inactividad/tope duro (misma infra que `invokeLlmStreamingWithIdleTimeout`).
 */

import type { BaseMessage } from "@langchain/core/messages";
import { extractLlmText, invokeLlmWithRetry, type InvokableLlm } from "./mdd-llm-retry.util.js";
import {
  isLlmStreamingEnabled,
  resolveLlmIdleTimeoutMs,
  resolveMddScopedArchitectHardTimeoutMs,
} from "./mdd-llm-timeout.util.js";
import { getActiveMddJobAbortSignal } from "../token-usage/token-usage.context.js";
import { supportsStreaming, type StreamableLlmLike } from "./mdd-llm-stream-invoke.util.js";

const CANONICAL_HEADING_RE = /^##\s+[1-7]\.\s+/gm;

/** True si el texto acumulado ya tiene ≥2 headings canónicos §1–§7. */
export function hasSecondCanonicalMddHeading(text: string): boolean {
  const re = new RegExp(CANONICAL_HEADING_RE.source, CANONICAL_HEADING_RE.flags);
  let count = 0;
  while (re.exec(text)) {
    count += 1;
    if (count >= 2) return true;
  }
  return false;
}

/** Recorta el texto antes del 2º heading canónico (si existe). */
export function trimBeforeSecondCanonicalMddHeading(text: string): string {
  const re = new RegExp(CANONICAL_HEADING_RE.source, CANONICAL_HEADING_RE.flags);
  let count = 0;
  let secondIndex = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    count += 1;
    if (count === 2) {
      secondIndex = m.index;
      break;
    }
  }
  if (secondIndex < 0) return text;
  return text.slice(0, secondIndex).trimEnd();
}

export type ScopedArchitectStreamOptions = {
  tag: string;
  idleTimeoutMs?: number;
  hardTimeoutMs?: number;
  signal?: AbortSignal;
};

function appendChunkText(acc: string, chunk: unknown): string {
  return acc + extractLlmText(chunk);
}

function timeoutError(
  tag: string,
  kind: "idle" | "hard",
  ms: number,
  chunks: number,
  elapsedMs: number,
): Error {
  const label = kind === "hard" ? `tope duro ${ms}ms` : `inactividad ${ms}ms`;
  return new Error(`[${tag}] scoped stream abortado por ${label} (chunks=${chunks}, elapsed=${elapsedMs}ms)`);
}

/**
 * Consume `llm.stream()` con idle/hard timeout, cortando al 2º heading canónico.
 */
async function invokeScopedArchitectStreamWithTimeouts(
  llm: StreamableLlmLike,
  messages: BaseMessage[],
  options: ScopedArchitectStreamOptions,
): Promise<{ content: string; chunks: number; totalMs: number; headingCapped: boolean }> {
  const idleTimeoutMs = options.idleTimeoutMs ?? resolveLlmIdleTimeoutMs();
  const hardTimeoutMs = options.hardTimeoutMs ?? resolveMddScopedArchitectHardTimeoutMs();
  const externalSignal = options.signal ?? getActiveMddJobAbortSignal();
  const startedAt = Date.now();
  const abortController = new AbortController();
  const onExternalAbort = (): void => abortController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) abortController.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  let idleTimedOut = false;
  let hardTimedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdleTimer = (): void => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      abortController.abort();
    }, idleTimeoutMs);
  };
  const hardTimer = setTimeout(() => {
    hardTimedOut = true;
    abortController.abort();
  }, hardTimeoutMs);

  let acc = "";
  let chunks = 0;
  let headingCapped = false;

  try {
    armIdleTimer();
    const stream = await (llm.stream as NonNullable<StreamableLlmLike["stream"]>)(messages, {
      signal: abortController.signal,
    });
    for await (const raw of stream as AsyncIterable<unknown>) {
      if (idleTimedOut || hardTimedOut) {
        throw timeoutError(
          options.tag,
          hardTimedOut ? "hard" : "idle",
          hardTimedOut ? hardTimeoutMs : idleTimeoutMs,
          chunks,
          Date.now() - startedAt,
        );
      }
      armIdleTimer();
      chunks += 1;
      acc = appendChunkText(acc, raw);
      if (hasSecondCanonicalMddHeading(acc)) {
        acc = trimBeforeSecondCanonicalMddHeading(acc);
        headingCapped = true;
        break;
      }
    }
    if (idleTimedOut || hardTimedOut) {
      throw timeoutError(
        options.tag,
        hardTimedOut ? "hard" : "idle",
        hardTimedOut ? hardTimeoutMs : idleTimeoutMs,
        chunks,
        Date.now() - startedAt,
      );
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    clearTimeout(hardTimer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }

  return { content: acc, chunks, totalMs: Date.now() - startedAt, headingCapped };
}

/**
 * Invoca el LLM en streaming para pasadas scoped; corta si aparece un 2º `## N.`.
 * Fallback a `invokeLlmWithRetry` (con timeout) si el stream falla, vacía o no hay `.stream()`.
 */
export async function invokeScopedArchitectLlmWithHeadingCap(
  llm: InvokableLlm,
  messages: BaseMessage[],
  options: ScopedArchitectStreamOptions,
): Promise<unknown> {
  const hardTimeoutMs = options.hardTimeoutMs ?? resolveMddScopedArchitectHardTimeoutMs();
  const idleTimeoutMs = options.idleTimeoutMs ?? resolveLlmIdleTimeoutMs();
  const retryOpts = {
    tag: options.tag,
    hardTimeoutMs,
    idleTimeoutMs,
    maxAttempts: 2,
    ...(options.signal ? { signal: options.signal } : {}),
  };

  if (isLlmStreamingEnabled() && supportsStreaming(llm)) {
    try {
      const result = await invokeScopedArchitectStreamWithTimeouts(llm as StreamableLlmLike, messages, {
        ...options,
        hardTimeoutMs,
        idleTimeoutMs,
      });
      if (result.content.trim()) {
        console.log(
          `[${options.tag}] scoped stream chunks=${result.chunks} totalMs=${result.totalMs} headingCapped=${result.headingCapped}`,
        );
        if (result.headingCapped) {
          console.log(`[${options.tag}] scoped stream abort: 2º heading canónico detectado`);
        }
        return { content: result.content };
      }
      console.warn(`[${options.tag}] scoped stream vacío tras ${result.chunks} chunks; fallback invoke`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[${options.tag}] scoped stream error: ${msg}; fallback invoke`);
    }
  }

  return invokeLlmWithRetry(llm, messages, { ...retryOpts, disableStreaming: true });
}
