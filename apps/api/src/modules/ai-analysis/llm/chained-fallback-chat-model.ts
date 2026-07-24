import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { isModelExhaustionError, runWithModelFallback } from "../../ai/config/llm-model-fallback.js";
import {
  bindToolsOnChatModel,
  invokeAsChatResult,
  streamAsChatChunks,
  type BoundToolsConfig,
} from "./chat-model-generate.js";

/**
 * Cadena de modelos sobre cualquier BaseChatModel: fallback solo en agotamiento (quota, 429, etc.).
 */
export class ChainedFallbackChatModel extends BaseChatModel {
  constructor(
    private readonly buildLlm: (model: string) => BaseChatModel,
    private readonly models: string[],
    private readonly toolsConfig?: BoundToolsConfig,
    params?: BaseChatModelParams,
    /**
     * Proveedor real para telemetría (TokenUsage). Enviado por `create-dbga-llm`.
     * El wrapper no expone `modelName` / `configuration.baseURL` de los
     * LLMs internos, así que `deriveLlmIdentity` lee este campo
     * directamente cuando está presente. Sin él, devuelve `modelId="unknown"`.
     */
    private readonly providerId?: string,
  ) {
    super(params ?? {});
  }

  _llmType(): string {
    return "chained-chat-fallback";
  }

  private resolveLlm(model: string) {
    return bindToolsOnChatModel(this.buildLlm(model), this.toolsConfig);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    return runWithModelFallback({
      models: this.models,
      label: "ChainedFallbackChatModel._generate",
      run: async (model) => invokeAsChatResult(this.resolveLlm(model), messages, options, runManager),
    });
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    let lastErr: unknown;
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i]!;
      let firstChunk: ChatGenerationChunk | undefined;
      let rest: AsyncIterator<ChatGenerationChunk> | undefined;
      try {
        await runWithModelFallback({
          models: [model],
          label: `ChainedFallbackChatModel._stream[${model}]`,
          run: async () => {
            const iter = streamAsChatChunks(this.resolveLlm(model), messages, options, runManager);
            const first = await iter.next();
            if (first.done) throw new Error(`empty stream from ${model}`);
            firstChunk = first.value;
            rest = iter;
          },
        });
        yield firstChunk!;
        while (rest) {
          const next = await rest.next();
          if (next.done) break;
          yield next.value;
        }
        return;
      } catch (err) {
        lastErr = err;
        const hasNext = i < this.models.length - 1;
        if (!hasNext || !isModelExhaustionError(err)) throw err;
        console.warn(
          `[ChainedFallbackChatModel] modelo ${model} agotado, probando ${this.models[i + 1]}`,
        );
      }
    }
    throw lastErr;
  }

  bindTools(
    tools: StructuredToolInterface[],
    kwargs?: Record<string, unknown>,
  ): BaseChatModel {
    return new ChainedFallbackChatModel(this.buildLlm, this.models, { tools, kwargs }, undefined, this.providerId);
  }
}
