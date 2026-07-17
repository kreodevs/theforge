import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import type { MddFlowTraceService } from "../mdd/mdd-flow-trace.service.js";
import { streamAsChatChunks, type LlmLike } from "../llm/chat-model-generate.js";

/** Intervalo entre logs de progreso durante espera LLM del arquitecto (~5–10 s). */
export const ARCHITECT_LLM_PROGRESS_INTERVAL_MS = 8_000;

export type ArchitectLlmProgressContext = {
  passNumber: number;
  passKind: string;
  promptChars: number;
  maxOutputTokens?: number | null;
  modelSlug?: string | null;
  toolsEnabled: boolean;
  toolLoop?: number;
  trace?: MddFlowTraceService | null;
  correlationId?: string | null;
  log?: (msg: string, ...args: unknown[]) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function basePayload(
  ctx: ArchitectLlmProgressContext,
  phase: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    node: "software_architect",
    phase,
    passNumber: ctx.passNumber,
    passKind: ctx.passKind,
    promptChars: ctx.promptChars,
    maxOutputTokens: ctx.maxOutputTokens ?? null,
    modelSlug: ctx.modelSlug ?? null,
    toolsEnabled: ctx.toolsEnabled,
    ...(ctx.toolLoop != null ? { toolLoop: ctx.toolLoop } : {}),
    ...extra,
  };
}

export function emitArchitectLlmProgress(
  ctx: ArchitectLlmProgressContext,
  phase: string,
  extra: Record<string, unknown> = {},
): void {
  const payload = basePayload(ctx, phase, extra);
  ctx.log?.(
    "phase=%s pass=%s elapsedMs=%s chars=%s model=%s passKind=%s promptChars=%s maxOut=%s",
    phase,
    ctx.passNumber,
    extra.elapsedMs ?? "-",
    extra.charsReceived ?? "-",
    ctx.modelSlug ?? "unknown",
    ctx.passKind,
    ctx.promptChars,
    ctx.maxOutputTokens ?? "-",
  );
  if (ctx.trace && ctx.correlationId) {
    ctx.trace.architectLlmProgress(ctx.correlationId, payload);
  }
}

async function waitWithProgress<T>(
  work: () => Promise<T>,
  onProgress: (elapsedMs: number) => void,
  intervalMs: number,
): Promise<T> {
  let settled = false;
  let result!: T;
  let error: unknown;
  const tracked = work().then(
    (value) => {
      settled = true;
      result = value;
    },
    (err) => {
      settled = true;
      error = err;
    },
  );

  const start = Date.now();
  while (!settled) {
    const winner = await Promise.race([
      tracked.then(() => "done" as const),
      sleep(intervalMs).then(() => "tick" as const),
    ]);
    if (winner === "tick" && !settled) {
      onProgress(Date.now() - start);
    }
  }

  await tracked;
  if (error !== undefined) throw error;
  return result;
}

/** Streaming invoke (sin tools): acumula texto y emite progreso cada ~8 s. */
export async function invokeArchitectLlmStreaming(
  llm: LlmLike,
  messages: BaseMessage[],
  ctx: ArchitectLlmProgressContext,
): Promise<string> {
  emitArchitectLlmProgress(ctx, "llm_invoke_start", { invokeMode: "streaming" });
  const invokeStart = Date.now();
  let text = "";
  let lastProgressAt = invokeStart;
  let chunkCount = 0;

  for await (const chunk of streamAsChatChunks(llm, messages, undefined)) {
    text += chunk.text;
    chunkCount += 1;
    const now = Date.now();
    if (now - lastProgressAt >= ARCHITECT_LLM_PROGRESS_INTERVAL_MS) {
      emitArchitectLlmProgress(ctx, "llm_stream_chunk", {
        elapsedMs: now - invokeStart,
        charsReceived: text.length,
        chunkCount,
        invokeMode: "streaming",
      });
      lastProgressAt = now;
    }
  }

  emitArchitectLlmProgress(ctx, "llm_invoke_end", {
    elapsedMs: Date.now() - invokeStart,
    charsReceived: text.length,
    chunkCount,
    invokeMode: "streaming",
  });
  return text;
}

/** Blocking invoke (con tools): emite llm_waiting cada ~8 s hasta resolver. */
export async function invokeArchitectLlmBlocking(
  llm: LlmLike,
  messages: BaseMessage[],
  ctx: ArchitectLlmProgressContext,
): Promise<AIMessage> {
  emitArchitectLlmProgress(ctx, "llm_invoke_start", { invokeMode: "blocking" });
  const invokeStart = Date.now();

  const response = await waitWithProgress(
    () => llm.invoke(messages).then((message) => message as AIMessage),
    (elapsedMs) => {
      emitArchitectLlmProgress(ctx, "llm_waiting", {
        elapsedMs,
        invokeMode: "blocking",
      });
    },
    ARCHITECT_LLM_PROGRESS_INTERVAL_MS,
  );

  const text = typeof response.content === "string" ? response.content : "";
  emitArchitectLlmProgress(ctx, "llm_invoke_end", {
    elapsedMs: Date.now() - invokeStart,
    charsReceived: text.length,
    invokeMode: "blocking",
  });
  return response;
}
