import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import {
  resolveLangChainChatTemperature,
  resolvePrimaryChatRuntime,
} from "../../ai/config/llm-config.js";

/**
 * Factory for DBGA graph: mismo runtime que el adapter principal (OpenRouter).
 */
/** @internal */ const LLM_TIMEOUT_MS = parseInt(
  process.env.LANGGRAPH_LLM_TIMEOUT_MS?.trim() || "300000",
  10,
);
const LOG_TIMEOUT = () => console.log(`[createDbgaLLM] timeout=${LLM_TIMEOUT_MS}ms`);

export function createDbgaLLM(): BaseChatModel {
  const r = resolvePrimaryChatRuntime();
  const temperature = resolveLangChainChatTemperature(r);
  LOG_TIMEOUT();
  return new ChatOpenAI({
    model: r.chatModel,
    temperature,
    timeout: LLM_TIMEOUT_MS,
    openAIApiKey: r.apiKey,
    configuration: { baseURL: r.baseURL },
  });
}
