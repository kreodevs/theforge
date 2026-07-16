import test from "node:test";
import assert from "node:assert/strict";
import { resolveModelByIntent } from "./resolve-model-by-intent.util.js";

test("resolveModelByIntent — explore en tab mdd usa tier C y chat 8K", () => {
  const r = resolveModelByIntent({ intent: "explore", action: "chat_only", activeTab: "mdd" });
  assert.equal(r.tier, "C");
  assert.equal(r.purpose, "chat");
  assert.equal(r.maxTokens, 8_192);
});

test("resolveModelByIntent — direct_edit en tab mdd usa chat 8K (no document 32K)", () => {
  const r = resolveModelByIntent({ intent: "direct_edit", action: "edit_document", activeTab: "mdd" });
  assert.equal(r.tier, "C");
  assert.equal(r.purpose, "chat");
  assert.equal(r.maxTokens, 8_192);
});

test("resolveModelByIntent — direct_edit en benchmark usa tier B y document 32K", () => {
  const r = resolveModelByIntent({
    intent: "direct_edit",
    action: "edit_document",
    activeTab: "benchmark",
  });
  assert.equal(r.tier, "B");
  assert.equal(r.purpose, "document");
  assert.equal(r.maxTokens, 32_768);
});

test("resolveModelByIntent — direct_edit en ux-ui-guide usa tier B y uxGuide 16K", () => {
  const r = resolveModelByIntent({
    intent: "direct_edit",
    action: "edit_document",
    activeTab: "ux-ui-guide",
  });
  assert.equal(r.tier, "B");
  assert.equal(r.purpose, "uxGuide");
  assert.equal(r.maxTokens, 16_384);
});

test("resolveModelByIntent — mixed usa tier C y chat 8K", () => {
  const r = resolveModelByIntent({ intent: "mixed", action: "confirm_then_edit", activeTab: "mdd" });
  assert.equal(r.tier, "C");
  assert.equal(r.purpose, "chat");
  assert.equal(r.maxTokens, 8_192);
});

test("resolveModelByIntent — welcomeBrief usa tier C y welcome 2K", () => {
  const r = resolveModelByIntent({ welcomeBrief: true, activeTab: "mdd" });
  assert.equal(r.tier, "C");
  assert.equal(r.purpose, "welcome");
  assert.equal(r.maxTokens, 2_048);
});

test("resolveModelByIntent — sin tab usa tier C y chat", () => {
  const r = resolveModelByIntent({ intent: "explore" });
  assert.equal(r.tier, "C");
  assert.equal(r.purpose, "chat");
});
