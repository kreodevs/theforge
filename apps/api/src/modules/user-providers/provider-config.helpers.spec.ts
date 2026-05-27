import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildModelFields,
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
