import test from "node:test";
import assert from "node:assert/strict";
import {
  getLlmProvidersSnapshot,
  isChatFallbackOn429Enabled,
  llmMaxTokens,
  resolveEmbeddingDimension,
  resolveLangChainChatTemperature,
} from "./llm-config.js";

test("resolveLangChainChatTemperature — 0.5", () => {
  assert.equal(resolveLangChainChatTemperature(), 0.5);
});

test("getLlmProvidersSnapshot — BYOK vacío", () => {
  assert.deepEqual(getLlmProvidersSnapshot(), []);
});

test("resolveEmbeddingDimension — default 1536", () => {
  const prev = process.env.OPENAI_EMBEDDING_DIM;
  delete process.env.OPENAI_EMBEDDING_DIM;
  delete process.env.EMBEDDING_DIM;
  try {
    assert.equal(resolveEmbeddingDimension(), 1536);
  } finally {
    if (prev !== undefined) process.env.OPENAI_EMBEDDING_DIM = prev;
  }
});

test("llmMaxTokens — default", () => {
  const prev = process.env.LLM_MAX_TOKENS;
  delete process.env.LLM_MAX_TOKENS;
  try {
    assert.equal(llmMaxTokens(), 120_000);
  } finally {
    if (prev !== undefined) process.env.LLM_MAX_TOKENS = prev;
  }
});

test("isChatFallbackOn429Enabled — sin fallbacks", () => {
  assert.equal(isChatFallbackOn429Enabled(false), false);
});
