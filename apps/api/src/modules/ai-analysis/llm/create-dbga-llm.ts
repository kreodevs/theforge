import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import {
  resolveLangChainChatTemperature,
  resolvePrimaryChatRuntime,
} from "../../ai/config/llm-config.js";

/**
 * Factory for DBGA graph: mismo runtime que el adapter principal (OpenRouter).
 */
export function createDbgaLLM(): BaseChatModel {
  const r = resolvePrimaryChatRuntime();
  const temperature = resolveLangChainChatTemperature(r);
  return new ChatOpenAI({
    model: r.chatModel,
    temperature,
    openAIApiKey: r.apiKey,
    configuration: { baseURL: r.baseURL },
  });
}
