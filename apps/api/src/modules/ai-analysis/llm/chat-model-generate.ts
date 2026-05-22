import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";

type LlmLike = {
  _generate?: BaseChatModel["_generate"];
  _streamResponseChunks?: BaseChatModel["_streamResponseChunks"];
  invoke: (messages: BaseMessage[], options?: unknown) => Promise<BaseMessage>;
  stream?: (messages: BaseMessage[], options?: unknown) => Promise<AsyncIterable<BaseMessage>>;
};

function messageText(message: BaseMessage): string {
  const { content } = message;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

/** `_generate` en BaseChatModel; `invoke` en Runnable devuelto por `bindTools`. */
export async function invokeAsChatResult(
  llm: LlmLike,
  messages: BaseMessage[],
  options: unknown,
  runManager?: CallbackManagerForLLMRun,
): Promise<ChatResult> {
  if (typeof llm._generate === "function") {
    return llm._generate(messages, options as never, runManager);
  }
  const message = await llm.invoke(messages, options);
  const text = messageText(message);
  return {
    generations: [{ text, message }],
  };
}

/** Streaming nativo o vía `stream()` del Runnable enlazado con tools. */
export async function* streamAsChatChunks(
  llm: LlmLike,
  messages: BaseMessage[],
  options: unknown,
  runManager?: CallbackManagerForLLMRun,
): AsyncGenerator<ChatGenerationChunk> {
  if (typeof llm._streamResponseChunks === "function") {
    yield* llm._streamResponseChunks(messages, options as never, runManager);
    return;
  }
  if (typeof llm.stream !== "function") {
    const result = await invokeAsChatResult(llm, messages, options, runManager);
    const gen = result.generations[0];
    if (!gen) return;
    yield new ChatGenerationChunk({
      text: gen.text,
      message: gen.message instanceof AIMessageChunk ? gen.message : new AIMessageChunk(gen.message),
    });
    return;
  }
  const stream = await llm.stream(messages, options);
  for await (const chunk of stream) {
    yield new ChatGenerationChunk({
      text: messageText(chunk),
      message: chunk instanceof AIMessageChunk ? chunk : new AIMessageChunk(chunk),
    });
  }
}

export type BoundToolsConfig = {
  tools: Parameters<NonNullable<BaseChatModel["bindTools"]>>[0];
  kwargs?: Record<string, unknown>;
};

export function bindToolsOnChatModel(
  llm: BaseChatModel,
  config?: BoundToolsConfig,
): LlmLike {
  if (!config?.tools?.length || !llm.bindTools) {
    return llm as unknown as LlmLike;
  }
  return llm.bindTools(config.tools, config.kwargs) as unknown as LlmLike;
}
