import { GoogleGenerativeAI } from "@google/generative-ai";

const EMBEDDING_MODEL = "gemini-embedding-001";

export async function generateGeminiTextEmbedding(text: string, apiKey: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}
