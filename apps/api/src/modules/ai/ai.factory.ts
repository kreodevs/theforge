import { OpenAIAdapter } from "./adapters/openai.adapter.js";
import { GeminiAdapter } from "./adapters/gemini.adapter.js";
import type { LLMProvider } from "./interfaces/llm-provider.interface.js";

const PROVIDER = process.env.AI_PROVIDER?.toLowerCase() ?? "openai";

export function createLLMProvider(): LLMProvider {
  if (PROVIDER === "google" || PROVIDER === "gemini") {
    return new GeminiAdapter();
  }
  return new OpenAIAdapter();
}
