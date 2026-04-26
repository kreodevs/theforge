import { OpenRouterAdapter } from "./adapters/openrouter.adapter.js";
import type { LLMProvider } from "./interfaces/llm-provider.interface.js";

export function createLLMProvider(): LLMProvider {
  return new OpenRouterAdapter();
}
