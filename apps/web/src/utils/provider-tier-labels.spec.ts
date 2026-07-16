import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROVIDER_TIER_META,
  providerTierInheritanceHint,
} from "./provider-tier-labels.js";
import { resolveEffectiveModelTiers } from "./resolve-effective-provider.js";
import type { ProviderInstanceSummary } from "@/types/user-providers";

const baseInstance = (
  overrides: Partial<ProviderInstanceSummary> & Pick<ProviderInstanceSummary, "id">,
): ProviderInstanceSummary => ({
  providerType: "openrouter",
  slug: "default",
  displayName: "OpenRouter",
  chatModel: "haiku",
  chatModelFallbacks: [],
  graphChatModel: null,
  architectChatModel: null,
  auditorChatModel: null,
  embeddingModel: null,
  embeddingDimension: null,
  sttModel: null,
  visionModel: null,
  baseUrl: null,
  extras: null,
  enabledForUsers: true,
  allowedChatModels: [],
  allowedEmbeddingModels: [],
  isTenantDefault: false,
  ...overrides,
});

describe("provider-tier-labels", () => {
  it("expone etiquetas Premium / Estándar / Ligero en español", () => {
    assert.equal(PROVIDER_TIER_META.premium.label, "Premium");
    assert.equal(PROVIDER_TIER_META.estandar.label, "Estándar");
    assert.equal(PROVIDER_TIER_META.ligero.label, "Ligero");
  });

  it("indica herencia entre tiers", () => {
    const instance = baseInstance({
      id: "x",
      chatModel: "haiku",
      graphChatModel: null,
      architectChatModel: null,
    });
    const effective = resolveEffectiveModelTiers(instance, null);
    assert.equal(providerTierInheritanceHint("ligero", effective), null);
    assert.equal(providerTierInheritanceHint("estandar", effective), "Hereda de Ligero");
    assert.equal(providerTierInheritanceHint("premium", effective), "Hereda de Ligero");
  });

  it("no muestra herencia cuando el tier está configurado", () => {
    const instance = baseInstance({
      id: "y",
      chatModel: "haiku",
      graphChatModel: "sonnet",
      architectChatModel: "opus",
    });
    const effective = resolveEffectiveModelTiers(instance, null);
    assert.equal(providerTierInheritanceHint("estandar", effective), null);
    assert.equal(providerTierInheritanceHint("premium", effective), null);
  });
});
