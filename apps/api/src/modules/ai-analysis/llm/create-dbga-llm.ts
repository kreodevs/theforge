import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const PROVIDER = process.env.AI_PROVIDER?.toLowerCase() ?? "openai";

/**
 * Factory for DBGA graph: returns a LangChain chat model based on AI_PROVIDER.
 * openai → ChatOpenAI (OPENAI_API_KEY), google → ChatGoogleGenerativeAI (GOOGLE_GENERATIVE_AI_API_KEY).
 */
export function createDbgaLLM(): BaseChatModel {
  if (PROVIDER === "google" || PROVIDER === "gemini") {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? "";
    return new ChatGoogleGenerativeAI({
      modelName: "gemini-2.0-flash",
      temperature: 0.5,
      apiKey: apiKey || undefined,
    });
  }
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  return new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0.5,
    openAIApiKey: apiKey || undefined,
  });
}
