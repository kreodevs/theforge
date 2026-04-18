import test from "node:test";
import assert from "node:assert/strict";
import {
  getLlmProvidersSnapshot,
  normalizeLlmProviderId,
  resolveEmbeddingsBackend,
  resolveOpenAiOfficialEmbeddingApiKey,
} from "./llm-config.js";

test("normalizeLlmProviderId — alias gemini/moonshot", () => {
  assert.equal(normalizeLlmProviderId("gemini"), "google");
  assert.equal(normalizeLlmProviderId("moonshot"), "kimi");
  assert.equal(normalizeLlmProviderId("openai"), "openai");
});

test("getLlmProvidersSnapshot — sin claves", () => {
  const prevAi = process.env.AI_API_KEY;
  const prevOpen = process.env.OPENAI_API_KEY;
  const prevGo = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  try {
    const snap = getLlmProvidersSnapshot();
    assert.equal(snap.find((s) => s.id === "openai")?.chatConfigured, false);
    assert.equal(snap.find((s) => s.id === "kimi")?.chatConfigured, false);
  } finally {
    if (prevAi !== undefined) process.env.AI_API_KEY = prevAi;
    else delete process.env.AI_API_KEY;
    if (prevOpen !== undefined) process.env.OPENAI_API_KEY = prevOpen;
    else delete process.env.OPENAI_API_KEY;
    if (prevGo !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevGo;
  }
});

test("resolveEmbeddingsBackend — override google", () => {
  const prev = process.env.LLM_EMBEDDINGS_PROVIDER;
  process.env.LLM_EMBEDDINGS_PROVIDER = "google";
  try {
    assert.equal(resolveEmbeddingsBackend(), "gemini");
  } finally {
    if (prev === undefined) delete process.env.LLM_EMBEDDINGS_PROVIDER;
    else process.env.LLM_EMBEDDINGS_PROVIDER = prev;
  }
});

test("resolveEmbeddingsBackend — kimi sin Google ni OPENAI_EMBEDDING_API_KEY → none", () => {
  const prevAi = process.env.AI_PROVIDER;
  const prevGo = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const prevGem = process.env.GEMINI_API_KEY;
  const prevEmb = process.env.OPENAI_EMBEDDING_API_KEY;
  const prevEmbPlural = process.env.OPENAI_EMBEDDINGS_API_KEY;
  const prevLlm = process.env.LLM_EMBEDDINGS_PROVIDER;
  process.env.AI_PROVIDER = "kimi";
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_EMBEDDING_API_KEY;
  delete process.env.OPENAI_EMBEDDINGS_API_KEY;
  delete process.env.LLM_EMBEDDINGS_PROVIDER;
  try {
    assert.equal(resolveEmbeddingsBackend(), "none");
    assert.equal(resolveOpenAiOfficialEmbeddingApiKey(), undefined);
  } finally {
    if (prevAi !== undefined) process.env.AI_PROVIDER = prevAi;
    else delete process.env.AI_PROVIDER;
    if (prevGo !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevGo;
    else delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (prevGem !== undefined) process.env.GEMINI_API_KEY = prevGem;
    else delete process.env.GEMINI_API_KEY;
    if (prevEmb !== undefined) process.env.OPENAI_EMBEDDING_API_KEY = prevEmb;
    else delete process.env.OPENAI_EMBEDDING_API_KEY;
    if (prevEmbPlural !== undefined) process.env.OPENAI_EMBEDDINGS_API_KEY = prevEmbPlural;
    else delete process.env.OPENAI_EMBEDDINGS_API_KEY;
    if (prevLlm !== undefined) process.env.LLM_EMBEDDINGS_PROVIDER = prevLlm;
    else delete process.env.LLM_EMBEDDINGS_PROVIDER;
  }
});

test("resolveEmbeddingsBackend — kimi con OPENAI_EMBEDDING_API_KEY → openai-official", () => {
  const prevAi = process.env.AI_PROVIDER;
  const prevGo = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const prevGem = process.env.GEMINI_API_KEY;
  const prevEmb = process.env.OPENAI_EMBEDDING_API_KEY;
  const prevLlm = process.env.LLM_EMBEDDINGS_PROVIDER;
  process.env.AI_PROVIDER = "kimi";
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENAI_EMBEDDING_API_KEY = "sk-openai-embed-only";
  delete process.env.LLM_EMBEDDINGS_PROVIDER;
  try {
    assert.equal(resolveEmbeddingsBackend(), "openai-official");
    assert.equal(resolveOpenAiOfficialEmbeddingApiKey(), "sk-openai-embed-only");
  } finally {
    if (prevAi !== undefined) process.env.AI_PROVIDER = prevAi;
    else delete process.env.AI_PROVIDER;
    if (prevGo !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prevGo;
    else delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (prevGem !== undefined) process.env.GEMINI_API_KEY = prevGem;
    else delete process.env.GEMINI_API_KEY;
    if (prevEmb !== undefined) process.env.OPENAI_EMBEDDING_API_KEY = prevEmb;
    else delete process.env.OPENAI_EMBEDDING_API_KEY;
    if (prevLlm !== undefined) process.env.LLM_EMBEDDINGS_PROVIDER = prevLlm;
    else delete process.env.LLM_EMBEDDINGS_PROVIDER;
  }
});
