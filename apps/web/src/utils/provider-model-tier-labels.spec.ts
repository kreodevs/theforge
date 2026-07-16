import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatModelShortLabel,
  resolveProviderModelTierRows,
} from "./provider-model-tier-labels.js";

describe("formatModelShortLabel", () => {
  it("strips OpenRouter provider prefix", () => {
    assert.equal(
      formatModelShortLabel("deepseek/deepseek-v4-flash:floor"),
      "deepseek-v4-flash:floor",
    );
    assert.equal(formatModelShortLabel("anthropic/claude-haiku"), "claude-haiku");
  });

  it("keeps model id when no slash", () => {
    assert.equal(formatModelShortLabel("gpt-4o-mini"), "gpt-4o-mini");
  });

  it("uses segment after last slash for nested paths", () => {
    assert.equal(formatModelShortLabel("openrouter/anthropic/claude-opus"), "claude-opus");
  });

  it("trims whitespace", () => {
    assert.equal(formatModelShortLabel("  deepseek/deepseek-v4-flash  "), "deepseek-v4-flash");
  });
});

describe("resolveProviderModelTierRows", () => {
  it("omits fallback hints on cards by default", () => {
    const rows = resolveProviderModelTierRows({
      chat: "deepseek/deepseek-v4-flash:floor",
      graph: "deepseek/deepseek-v4-flash:floor",
      graphSource: "chat-fallback",
      architect: "deepseek/deepseek-v4-flash:floor",
      architectSource: "chat-fallback",
    });

    assert.equal(rows.every((row) => row.hint === null), true);
    assert.equal(rows[0]?.displayModel, "deepseek-v4-flash:floor");
    assert.equal(rows[0]?.model, "deepseek/deepseek-v4-flash:floor");
  });

  it("includes hints when showHints is true", () => {
    const rows = resolveProviderModelTierRows(
      {
        chat: "haiku",
        graph: "haiku",
        graphSource: "chat-fallback",
        architect: "haiku",
        architectSource: "chat-fallback",
      },
      { showHints: true },
    );

    assert.match(rows.find((row) => row.tier === "graph")?.hint ?? "", /chat/i);
  });
});
