import { OpenAIAdapter } from "./adapters/openai.adapter.js";
import { GeminiAdapter } from "./adapters/gemini.adapter.js";
import type { LLMProvider } from "./interfaces/llm-provider.interface.js";
import { normalizeLlmProviderId } from "./config/llm-config.js";

export function createLLMProvider(): LLMProvider {
  const id = normalizeLlmProviderId();
  if (id === "google") {
    return new GeminiAdapter();
  }
  return new OpenAIAdapter();
}
