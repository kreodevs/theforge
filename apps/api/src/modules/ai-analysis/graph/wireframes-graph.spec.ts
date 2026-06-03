import test from "node:test";
import assert from "node:assert/strict";
import { createWireframesGraph } from "./wireframes-graph.js";
import type { ComponentSourcePort } from "@theforge/component-source";

const mockPort = {
  capabilities: {
    catalog: { list: true, props: true, get: true, search: true, resolve: true, recipe: true },
    designSystem: { get: true },
  },
  checkHealth: async () => ({ ok: true }),
  listModules: async () => ({ content: [{ type: "text", text: '{"modules":[]}' }] }),
  getDesignSystem: async () => ({ content: [{ type: "text", text: '{"designMd":"# DS"}' }] }),
  resolveComponents: async () => ({ content: [{ type: "text", text: '{"results":[]}' }] }),
  getComponent: async () => ({ content: [{ type: "text", text: "{}" }] }),
  getProps: async () => ({ content: [{ type: "text", text: "{}" }] }),
  searchModules: async () => ({ content: [{ type: "text", text: '{"hits":[]}' }] }),
  getCompositionRecipe: async () => ({ content: [{ type: "text", text: "{}" }] }),
} as unknown as ComponentSourcePort;

const mockFactory = {
  resolveRuntime: async () => ({
    providerId: "openrouter",
    chatModel: "test/model",
    apiKey: "test-key",
    baseURL: "https://example.com",
  }),
} as never;

test("createWireframesGraph — ds-refresh compila sin screen_analyzer", async () => {
  const graph = await createWireframesGraph(mockFactory, "user-1", mockPort, undefined, {
    entryPoint: "component_mapper",
    skipCritic: true,
  });
  assert.ok(graph);
});

test("createWireframesGraph — full pipeline compila", async () => {
  const graph = await createWireframesGraph(mockFactory, "user-1", mockPort);
  assert.ok(graph);
});
