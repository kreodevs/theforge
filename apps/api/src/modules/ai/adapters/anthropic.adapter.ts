import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  ChatMessage,
  GenerateResponseOptions,
} from "../interfaces/llm-provider.interface.js";
import type { ChatImagePart, ChecklistResult } from "@theforge/shared-types";
import type { UserLLMRuntime } from "../providers/llm-runtime.types.js";
import {
  resolveLlmMaxTokensForPurpose,
  resolveLlmMaxTokensForWorkshopTab,
} from "../config/llm-config.js";

function toAnthropicMessages(
  history: ChatMessage[],
  prompt: string,
  images?: ChatImagePart[],
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of history) {
    if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content });
      continue;
    }
    const blocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: m.content }];
    for (const img of m.images ?? []) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: img.base64,
        },
      });
    }
    out.push({ role: "user", content: blocks });
  }
  const lastBlocks: Anthropic.ContentBlockParam[] = [{ type: "text", text: prompt }];
  for (const img of images ?? []) {
    lastBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: img.base64,
      },
    });
  }
  out.push({ role: "user", content: lastBlocks });
  return out;
}

export class AnthropicAdapter implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(runtime: UserLLMRuntime) {
    this.client = new Anthropic({ apiKey: runtime.apiKey });
    this.model = runtime.chatModel;
  }

  async generateResponse(
    prompt: string,
    history: ChatMessage[],
    options?: GenerateResponseOptions,
  ): Promise<string> {
    const messages = toAnthropicMessages(history, prompt, options?.userMessageImages);
    if (options?.jsonObjectMode) {
      messages.push({ role: "assistant", content: "{" });
    }
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens:
        options?.maxTokensOverride ??
        resolveLlmMaxTokensForWorkshopTab(options?.activeTab, {
          welcomeBrief: options?.welcomeBrief,
        }),
      system: options?.systemPrompt,
      messages,
    });
    const block = res.content.find((b) => b.type === "text");
    const text = block?.type === "text" ? block.text : "";
    return options?.jsonObjectMode ? `{${text}` : text;
  }

  async generateResponseStream(
    prompt: string,
    history: ChatMessage[],
    options?: GenerateResponseOptions,
  ): Promise<AsyncIterable<string>> {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens:
        options?.maxTokensOverride ??
        resolveLlmMaxTokensForWorkshopTab(options?.activeTab, {
          welcomeBrief: options?.welcomeBrief,
        }),
      system: options?.systemPrompt,
      messages: toAnthropicMessages(history, prompt, options?.userMessageImages),
      stream: true,
    });

    return {
      async *[Symbol.asyncIterator]() {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            yield event.delta.text;
          }
        }
      },
    };
  }

  async parseChecklist(text: string): Promise<ChecklistResult> {
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: resolveLlmMaxTokensForPurpose("checklist"),
        system:
          "Parse the following text and return a JSON object with keys: complete (boolean), items (array of {key, present, value?}).",
        messages: [{ role: "user", content: text }],
      });
      const block = res.content.find((b) => b.type === "text");
      const raw = block?.type === "text" ? block.text : "{}";
      const parsed = JSON.parse(raw) as ChecklistResult;
      return {
        complete: Boolean(parsed.complete),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch {
      return { complete: false, items: [] };
    }
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return [];
  }
}
