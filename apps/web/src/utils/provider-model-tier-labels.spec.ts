import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROVIDER_TIER_USAGE,
  providerTierHint,
  resolveProviderModelTierRows,
} from "./provider-model-tier-labels.js";

describe("providerTierHint", () => {
  it("lista agentes cuando el tier está configurado", () => {
    assert.match(providerTierHint("graph", "configured"), /Usado en:/);
    assert.match(providerTierHint("graph", "configured"), /Clarifier/);
    assert.match(providerTierHint("architect", "configured"), /software_architect/);
    assert.match(providerTierHint("chat"), /Workshop chat/);
  });

  it("indica herencia y mantiene el uso del tier", () => {
    assert.match(providerTierHint("graph", "chat-fallback"), /Hereda de chat/);
    assert.match(providerTierHint("graph", "chat-fallback"), /Quality Gate/);
    assert.match(providerTierHint("architect", "graph-fallback"), /Hereda de grafo/);
    assert.match(providerTierHint("architect", "graph-fallback"), /Legacy Coordinador/);
    assert.match(providerTierHint("architect", "chat-fallback"), /Hereda de chat/);
  });
});

describe("resolveProviderModelTierRows", () => {
  it("incluye hint de uso en los tres tiers", () => {
    const rows = resolveProviderModelTierRows({
      chat: "haiku",
      graph: "haiku",
      graphSource: "chat-fallback",
      architect: "sonnet",
      architectSource: "configured",
    });
    assert.equal(rows.length, 3);
    assert.match(rows.find((r) => r.tier === "chat")?.hint ?? "", /Workshop chat/);
    assert.match(rows.find((r) => r.tier === "graph")?.hint ?? "", /Hereda de chat/);
    assert.match(rows.find((r) => r.tier === "architect")?.hint ?? "", /Usado en:/);
    assert.doesNotMatch(rows.find((r) => r.tier === "architect")?.hint ?? "", /Hereda/);
  });

  it("expone listas de uso por tier", () => {
    assert.ok(PROVIDER_TIER_USAGE.chat.includes("intent router"));
    assert.ok(PROVIDER_TIER_USAGE.graph.includes("tasks planner"));
    assert.ok(PROVIDER_TIER_USAGE.architect.includes("§2"));
  });
});
