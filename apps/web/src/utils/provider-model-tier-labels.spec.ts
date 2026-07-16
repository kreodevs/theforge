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
    assert.match(providerTierHint("graph", "configured"), /Clarificador/);
    assert.match(providerTierHint("architect", "configured"), /Arquitecto/);
    assert.match(providerTierHint("chat"), /Chat Workshop/);
  });

  it("indica herencia y mantiene el uso del tier", () => {
    assert.match(providerTierHint("graph", "chat-fallback"), /Hereda de chat/);
    assert.match(providerTierHint("graph", "chat-fallback"), /Control de calidad MDD/);
    assert.match(providerTierHint("architect", "graph-fallback"), /Hereda de grafo/);
    assert.match(providerTierHint("architect", "graph-fallback"), /Coordinador legacy/);
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
    assert.match(rows.find((r) => r.tier === "chat")?.hint ?? "", /Chat Workshop/);
    assert.match(rows.find((r) => r.tier === "graph")?.hint ?? "", /Hereda de chat/);
    assert.match(rows.find((r) => r.tier === "architect")?.hint ?? "", /Usado en:/);
    assert.doesNotMatch(rows.find((r) => r.tier === "architect")?.hint ?? "", /Hereda/);
  });

  it("expone listas de uso por tier", () => {
    assert.ok(PROVIDER_TIER_USAGE.chat.includes("Clasificador de intención"));
    assert.ok(PROVIDER_TIER_USAGE.graph.includes("Planificador y auditor de tareas"));
    assert.ok(PROVIDER_TIER_USAGE.architect.includes("SQL"));
  });
});
