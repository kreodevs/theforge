/** Mirrors apps/api provider-catalog + user-providers responses. */

export type ProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "gemini"
  | "cloudflare"
  | "groq";

export interface ProviderExtraFieldSpec {
  key: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface ImageModelInfo {
  id: string;
  label: string;
  priceIn?: string;
  priceOut?: string;
  description?: string;
  originProvider?: string;
}

export interface ProviderCatalogEntry {
  id: ProviderId;
  label: string;
  apiKeyHelpUrl?: string;
  defaultChatModel: string;
  chatModels?: string[];
  defaultEmbeddingModel: string | null;
  embeddingModels?: string[];
  defaultEmbeddingDimension: number | null;
  defaultSttModel: string | null;
  defaultVisionModel: string | null;
  imageModels?: string[];
  imageModelDetails?: Record<string, ImageModelInfo>;
  defaultImageModel: string | null;
  defaultBaseUrl: string;
  baseUrlEditable?: boolean;
  extraFields?: ProviderExtraFieldSpec[];
  supportsEmbeddings: boolean;
  supportsVision: boolean;
  supportsStt: boolean;
  supportsImageGeneration: boolean;
}

export interface UserProviderConfigSummary {
  provider: ProviderId;
  chatModel: string;
  chatModelFallbacks: string[];
  embeddingModel: string | null;
  embeddingDimension: number | null;
  sttModel: string | null;
  visionModel: string | null;
  imageModel: string | null;
  baseUrl: string | null;
  extras: Record<string, unknown> | null;
  configured: boolean;
  apiKeyHint: string;
}

export interface UserAISettings {
  activeProvider: ProviderId | null;
  activeTenantInstanceId: string | null;
  /** @deprecated Ya no se usa; el Auditor toma `auditorChatModel` de la instancia activa. */
  mddAuditorTenantInstanceId: string | null;
  embeddingProvider: ProviderId | null;
  embeddingsEnabled: boolean;
  allowedChatModels?: string[];
  imageModel: string | null;
  imageQuality: string;
  imageStyle: string;
}

export interface ProviderInstanceSummary {
  id: string;
  providerType: ProviderId;
  slug: string;
  displayName: string;
  chatModel: string;
  chatModelFallbacks: string[];
  /** Tier B (medio): grafo MDD, Quality Gate, entregables. */
  graphChatModel: string | null;
  /** Tier A (potente): software_architect §2–§5. */
  architectChatModel: string | null;
  /** @deprecated Migrado a graphChatModel; se mantiene una release. */
  auditorChatModel: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  sttModel: string | null;
  visionModel: string | null;
  imageModel: string | null;
  baseUrl: string | null;
  extras: Record<string, unknown> | null;
  enabledForUsers: boolean;
  allowedChatModels: string[];
  allowedEmbeddingModels: string[];
  isTenantDefault: boolean;
  createdByUserId?: string;
  apiKeyHint?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertProviderInstanceBody {
  providerType: ProviderId;
  slug: string;
  displayName: string;
  apiKey: string;
  chatModel?: string;
  chatModelFallbacks?: string[];
  graphChatModel?: string | null;
  architectChatModel?: string | null;
  auditorChatModel?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  sttModel?: string | null;
  visionModel?: string | null;
  imageModel?: string | null;
  baseUrl?: string | null;
  extras?: Record<string, unknown> | null;
  enabledForUsers?: boolean;
  allowedChatModels?: string[];
  allowedEmbeddingModels?: string[];
  isTenantDefault?: boolean;
}

export interface UpsertProviderConfigBody {
  apiKey: string;
  chatModel?: string;
  chatModelFallbacks?: string[];
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  sttModel?: string | null;
  visionModel?: string | null;
  imageModel?: string | null;
  baseUrl?: string | null;
  extras?: Record<string, unknown> | null;
}

export interface UpdateAISettingsBody {
  activeProvider?: ProviderId;
  activeTenantInstanceId?: string | null;
  embeddingProvider?: ProviderId | null;
  embeddingsEnabled?: boolean;
  imageModel?: string | null;
  imageQuality?: string;
  imageStyle?: string;
}
