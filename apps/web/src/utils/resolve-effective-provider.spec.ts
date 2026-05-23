import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEffectiveProvider } from "./resolve-effective-provider.js";
import type {
  ProviderInstanceSummary,
  UserAISettings,
  UserProviderConfigSummary,
} from "@/types/user-providers";

const baseInstance = (
  overrides: Partial<ProviderInstanceSummary> & Pick<ProviderInstanceSummary, "id">,
): ProviderInstanceSummary => ({
  providerType: "openrouter",
  slug: "default",
  displayName: "OpenRouter",
  chatModel: "gpt-4o-mini",
  chatModelFallbacks: [],
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

describe("resolveEffectiveProvider", () => {
  it("prefiere instancia marcada como activa", () => {
    const instances = [
      baseInstance({ id: "a", displayName: "A", isTenantDefault: true }),
      baseInstance({ id: "b", displayName: "B" }),
    ];
    const settings: UserAISettings = {
      activeProvider: null,
      activeTenantInstanceId: "b",
      mddAuditorTenantInstanceId: null,
      embeddingProvider: null,
      embeddingsEnabled: true,
    };
    const result = resolveEffectiveProvider(instances, settings, []);
    assert.equal(result.source, "selected-instance");
    assert.equal(result.instance?.id, "b");
  });

  it("usa predeterminada del equipo si no hay selección", () => {
    const instances = [
      baseInstance({ id: "a", isTenantDefault: false }),
      baseInstance({ id: "b", isTenantDefault: true, displayName: "Team default" }),
    ];
    const settings: UserAISettings = {
      activeProvider: null,
      activeTenantInstanceId: null,
      mddAuditorTenantInstanceId: null,
      embeddingProvider: null,
      embeddingsEnabled: true,
    };
    const result = resolveEffectiveProvider(instances, settings, []);
    assert.equal(result.source, "tenant-default");
    assert.equal(result.instance?.id, "b");
  });

  it("cae a BYOK personal si no hay instancias tenant", () => {
    const settings: UserAISettings = {
      activeProvider: "openai",
      activeTenantInstanceId: null,
      mddAuditorTenantInstanceId: null,
      embeddingProvider: null,
      embeddingsEnabled: true,
    };
    const configs: UserProviderConfigSummary[] = [
      {
        provider: "openai",
        chatModel: "gpt-4o",
        chatModelFallbacks: [],
        embeddingModel: null,
        embeddingDimension: null,
        sttModel: null,
        visionModel: null,
        baseUrl: null,
        extras: null,
        configured: true,
        apiKeyHint: "sk-…1234",
      },
    ];
    const result = resolveEffectiveProvider([], settings, configs);
    assert.equal(result.source, "personal-byok");
    assert.equal(result.personalConfig?.provider, "openai");
  });
});
