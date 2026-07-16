import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildModelFields,
  resolveTierChatModel,
  resolveVisionModelForRuntime,
} from "./provider-config.helpers.js";

describe("resolveVisionModelForRuntime", () => {
  it("prefiere columna visionModel de la instancia", () => {
    const model = resolveVisionModelForRuntime({
      visionModel: "llama/llama-3.2-11b-vision-instruct:floor",
      chatModel: "deepseek/deepseek-v4-flash:floor",
      extras: {},
      catalogDefaultVisionModel: "openai/gpt-4o",
      supportsVision: true,
    });
    assert.equal(model, "llama/llama-3.2-11b-vision-instruct:floor");
  });

  it("usa extras.visionModel legacy si la columna está vacía", () => {
    const model = resolveVisionModelForRuntime({
      visionModel: null,
      chatModel: "deepseek/deepseek-v4-flash:floor",
      extras: { visionModel: "openai/gpt-4o" },
      catalogDefaultVisionModel: null,
      supportsVision: true,
    });
    assert.equal(model, "openai/gpt-4o");
  });
});

describe("buildModelFields visionModel", () => {
  it("no aplica default del catálogo si visionModel es undefined", () => {
    const fields = buildModelFields("openrouter", {
      chatModel: "deepseek/deepseek-v4-flash:floor",
      visionModel: undefined,
    });
    assert.equal(fields.visionModel, undefined);
  });

  it("aplica default del catálogo si visionModel es cadena vacía", () => {
    const fields = buildModelFields("openrouter", {
      chatModel: "deepseek/deepseek-v4-flash:floor",
      visionModel: "",
    });
    assert.equal(fields.visionModel, "openai/gpt-4o");
  });
});

describe("resolveTierChatModel", () => {
  const tiers = {
    chatModel: "anthropic/claude-haiku",
    graphChatModel: null,
    architectChatModel: null,
    auditorChatModel: null,
  };

  it("tier graph usa chatModel si graph y auditor vacíos", () => {
    assert.equal(resolveTierChatModel(tiers, "graph"), "anthropic/claude-haiku");
  });

  it("tier graph prefiere graphChatModel", () => {
    assert.equal(
      resolveTierChatModel({ ...tiers, graphChatModel: "anthropic/claude-sonnet" }, "graph"),
      "anthropic/claude-sonnet",
    );
  });

  it("tier graph cae a auditorChatModel legado si graph vacío", () => {
    assert.equal(
      resolveTierChatModel({ ...tiers, auditorChatModel: "anthropic/claude-sonnet" }, "graph"),
      "anthropic/claude-sonnet",
    );
  });

  it("tier architect aplica cadena architect → graph → chat", () => {
    assert.equal(
      resolveTierChatModel(
        {
          chatModel: "anthropic/claude-haiku",
          graphChatModel: "anthropic/claude-sonnet",
          architectChatModel: null,
        },
        "architect",
      ),
      "anthropic/claude-sonnet",
    );
    assert.equal(
      resolveTierChatModel(
        {
          chatModel: "anthropic/claude-haiku",
          graphChatModel: "anthropic/claude-sonnet",
          architectChatModel: "anthropic/claude-opus",
        },
        "architect",
      ),
      "anthropic/claude-opus",
    );
  });
});

describe("buildModelFields graph/architect tiers", () => {
  it("normaliza graphChatModel y architectChatModel opcionales", () => {
    const fields = buildModelFields("openrouter", {
      chatModel: "deepseek/deepseek-v4-flash:floor",
      graphChatModel: "  anthropic/claude-sonnet  ",
      architectChatModel: "",
      auditorChatModel: "  legacy/auditor  ",
    });
    assert.equal(fields.graphChatModel, "anthropic/claude-sonnet");
    assert.equal(fields.architectChatModel, null);
    assert.equal(fields.auditorChatModel, "legacy/auditor");
  });
});
