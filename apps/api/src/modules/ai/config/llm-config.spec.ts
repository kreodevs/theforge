import test from "node:test";
import assert from "node:assert/strict";
import {
  getLlmProvidersSnapshot,
  normalizeLlmProviderId,
  resolveEmbeddingsBackend,
  resolveOpenRouterEmbeddingApiKey,
  resolveLangChainChatTemperature,
} from "./llm-config.js";

test("resolveLangChainChatTemperature — openrouter 0.5", () => {
  assert.equal(resolveLangChainChatTemperature({ providerId: "openrouter" }), 0.5);
});

test("normalizeLlmProviderId — siempre openrouter", () => {
  assert.equal(normalizeLlmProviderId("openai"), "openrouter");
  assert.equal(normalizeLlmProviderId("gemini"), "openrouter");
});

test("getLlmProvidersSnapshot — sin clave", () => {
  const prev = process.env.OPENROUTER_API_KEY;
  const prevAi = process.env.AI_API_KEY;
  const prevOpen = process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const snap = getLlmProvidersSnapshot();
    assert.equal(snap.length, 1);
    assert.equal(snap[0]?.id, "openrouter");
    assert.equal(snap[0]?.chatConfigured, false);
    assert.equal(snap[0]?.active, true);
  } finally {
    if (prev !== undefined) process.env.OPENROUTER_API_KEY = prev;
    else delete process.env.OPENROUTER_API_KEY;
    if (prevAi !== undefined) process.env.AI_API_KEY = prevAi;
    else delete process.env.AI_API_KEY;
    if (prevOpen !== undefined) process.env.OPENAI_API_KEY = prevOpen;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("resolveEmbeddingsBackend — none", () => {
  const prev = process.env.LLM_EMBEDDINGS_PROVIDER;
  process.env.LLM_EMBEDDINGS_PROVIDER = "none";
  try {
    assert.equal(resolveEmbeddingsBackend(), "none");
  } finally {
    if (prev === undefined) delete process.env.LLM_EMBEDDINGS_PROVIDER;
    else process.env.LLM_EMBEDDINGS_PROVIDER = prev;
  }
});

test("resolveOpenRouterEmbeddingApiKey — con AI_API_KEY", () => {
  const prev = process.env.OPENROUTER_API_KEY;
  const prevEmb = process.env.OPENROUTER_EMBEDDING_API_KEY;
  const prevLlm = process.env.LLM_EMBEDDINGS_PROVIDER;
  const prevAi = process.env.AI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_EMBEDDING_API_KEY;
  delete process.env.LLM_EMBEDDINGS_PROVIDER;
  process.env.AI_API_KEY = "sk-test";
  try {
    assert.equal(resolveEmbeddingsBackend(), "openrouter");
    assert.equal(resolveOpenRouterEmbeddingApiKey(), "sk-test");
  } finally {
    if (prev !== undefined) process.env.OPENROUTER_API_KEY = prev;
    else delete process.env.OPENROUTER_API_KEY;
    if (prevEmb !== undefined) process.env.OPENROUTER_EMBEDDING_API_KEY = prevEmb;
    else delete process.env.OPENROUTER_EMBEDDING_API_KEY;
    if (prevLlm !== undefined) process.env.LLM_EMBEDDINGS_PROVIDER = prevLlm;
    else delete process.env.LLM_EMBEDDINGS_PROVIDER;
    if (prevAi !== undefined) process.env.AI_API_KEY = prevAi;
    else delete process.env.AI_API_KEY;
  }
});
