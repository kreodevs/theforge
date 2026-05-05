import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import {
  resolveLangChainChatTemperature,
  resolveComponentChatModel,
  resolveOpenRouterApiKey,
} from "../../ai/config/llm-config.js";

/**
 * Factory for DBGA graph: mismo runtime que el adapter principal (OpenRouter).
 * Modelo vía OPENROUTER_CHAT_MODEL_DBGA → OPENROUTER_CHAT_MODEL → default Hermes 405B.
 */
/** @internal */ const LLM_TIMEOUT_MS = parseInt(
  process.env.LANGGRAPH_LLM_TIMEOUT_MS?.trim() || "300000",
  10,
);
const LOG_TIMEOUT = () => console.log(`[createDbgaLLM] timeout=${LLM_TIMEOUT_MS}ms`);

export function createDbgaLLM(): BaseChatModel {
  const model = resolveComponentChatModel("DBGA");
  const apiKey = resolveOpenRouterApiKey();
  const temperature = resolveLangChainChatTemperature({ providerId: "openrouter" });
  LOG_TIMEOUT();
  console.log(`[createDbgaLLM] using model=${model}`);
  return new ChatOpenAI({
    model,
    temperature,
    timeout: LLM_TIMEOUT_MS,
    openAIApiKey: apiKey,
    configuration: { baseURL: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1" },
  });
}
