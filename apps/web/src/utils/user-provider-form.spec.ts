import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProviderCatalogEntry } from "@/types/user-providers";
import { validateUserProviderForm } from "./user-provider-form.js";

const catalog: ProviderCatalogEntry = {
  id: "openrouter",
  label: "OpenRouter",
  defaultChatModel: "anthropic/claude-haiku",
  defaultEmbeddingModel: null,
  defaultEmbeddingDimension: null,
  defaultSttModel: null,
  defaultVisionModel: null,
  defaultImageModel: null,
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  supportsEmbeddings: false,
  supportsVision: false,
  supportsStt: false,
  supportsImageGeneration: false,
};

const baseForm = {
  apiKey: "sk-test",
  chatModel: "anthropic/claude-haiku",
  chatModelFallbacks: "",
  graphChatModel: "",
  architectChatModel: "",
  embeddingModel: "",
  sttModel: "",
  visionModel: "",
  visionModelFallback: "",
  baseUrl: "",
  extras: {},
};

describe("validateUserProviderForm instanceModelTiers", () => {
  it("rechaza grafo igual al chat cuando tiers activos", () => {
    const errors = validateUserProviderForm({
      catalog,
      form: { ...baseForm, graphChatModel: "anthropic/claude-haiku" },
      isEditing: false,
      instanceModelTiers: true,
    });
    assert.match(errors.graphChatModel ?? "", /mismo que el de chat/i);
  });

  it("advierte cuando los tres modelos son iguales", () => {
    const errors = validateUserProviderForm({
      catalog,
      form: {
        ...baseForm,
        graphChatModel: "anthropic/claude-haiku",
        architectChatModel: "anthropic/claude-haiku",
      },
      isEditing: false,
      instanceModelTiers: true,
    });
    assert.ok(errors.graphChatModel || errors.architectChatModel);
  });

  it("no valida tiers en BYOK personal", () => {
    const errors = validateUserProviderForm({
      catalog,
      form: { ...baseForm, graphChatModel: "anthropic/claude-haiku" },
      isEditing: false,
    });
    assert.equal(errors.graphChatModel, undefined);
  });
});
