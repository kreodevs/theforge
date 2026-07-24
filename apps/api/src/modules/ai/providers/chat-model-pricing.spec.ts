/**
 * Tests del módulo de pricing. Verifica cálculo USD/MXN, fallback y override.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateChatCostUsd,
  MXN_PER_USD,
  registerChatModelPricingOverride,
  resolveChatModelPricing,
  usdToMxn,
} from "./chat-model-pricing.js";

describe("chat-model-pricing", () => {
  it("MXN_PER_USD tiene el valor 20 por defecto", () => {
    assert.equal(MXN_PER_USD, 20);
  });

  it("resuelve pricing directo OpenAI gpt-4o", () => {
    const p = resolveChatModelPricing("openai", "gpt-4o");
    assert.deepEqual(p, {
      input: 2.5,
      output: 10,
      source: "openai",
    });
  });

  it("resuelve pricing OpenRouter con prefijo upstream", () => {
    const p = resolveChatModelPricing("openrouter", "openai/gpt-4o");
    assert.deepEqual(p, {
      input: 2.5,
      output: 10,
      source: "openrouter",
      capturedAt: "2026-07-24",
    });
  });

  it("resuelve pricing Anthropic sonnet-4", () => {
    const p = resolveChatModelPricing("anthropic", "claude-sonnet-4-20250514");
    assert.equal(p?.input, 3);
    assert.equal(p?.output, 15);
  });

  it("resuelve pricing Gemini 2.5-flash", () => {
    const p = resolveChatModelPricing("gemini", "gemini-2.5-flash");
    assert.equal(p?.input, 0.3);
    assert.equal(p?.output, 2.5);
  });

  it("devuelve null para modelo desconocido", () => {
    const p = resolveChatModelPricing("openai", "gpt-99-ultra");
    assert.equal(p, null);
  });

  it("calcula USD con fórmula input*priceIn + output*priceOut", () => {
    // 1M input + 1M output con gpt-4o: 2.5 + 10 = 12.5 USD
    const cost = calculateChatCostUsd("openai", "gpt-4o", 1_000_000, 1_000_000);
    assert.equal(cost, 12.5);
  });

  it("calcula USD con tokens parciales", () => {
    // 100k input + 50k output con gpt-4o-mini: 0.015 + 0.030 = 0.045 USD
    const cost = calculateChatCostUsd(
      "openai",
      "gpt-4o-mini",
      100_000,
      50_000,
    );
    assert.equal(cost, 0.045);
  });

  it("devuelve 0 USD cuando el modelo no está catalogado", () => {
    const cost = calculateChatCostUsd("openai", "gpt-99-ultra", 100_000, 100_000);
    assert.equal(cost, 0);
  });

  it("convierte USD a MXN con la constante fija", () => {
    assert.equal(usdToMxn(10), 200);
    assert.equal(usdToMxn(0.5), 10);
    assert.equal(usdToMxn(0), 0);
  });

  it("acepta override de pricing en runtime", () => {
    registerChatModelPricingOverride("openai", "gpt-4o-custom", {
      input: 1,
      output: 2,
      source: "manual",
    });
    const cost = calculateChatCostUsd("openai", "gpt-4o-custom", 1_000_000, 1_000_000);
    assert.equal(cost, 3);
  });

  it("OpenRouter usa el slug upstream completo", () => {
    const p = resolveChatModelPricing("openrouter", "anthropic/claude-sonnet-4");
    assert.equal(p?.input, 3);
    assert.equal(p?.output, 15);
  });

  it("OpenRouter: precio de minimax/minimax-m3 y variant :nitro", () => {
    const p1 = resolveChatModelPricing("openrouter", "minimax/minimax-m3");
    assert.equal(p1?.input, 0.2);
    const p2 = resolveChatModelPricing("openrouter", "minimax/minimax-m3:nitro");
    assert.equal(p2?.input, 0.05);
    assert.equal(p2?.output, 0.2);
  });
});
