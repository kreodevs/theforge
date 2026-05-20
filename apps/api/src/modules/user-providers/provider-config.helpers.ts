import { BadRequestException } from "@nestjs/common";
import {
  buildCloudflareBaseUrl,
  PROVIDER_CATALOG,
  resolveCloudflareAccountId,
  resolveEmbeddingDimensionForModel,
  type ProviderId,
} from "../ai/providers/provider-catalog.js";

export function normalizeFallbacks(raw?: string[]): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  return raw
    .map((m) => m.trim())
    .filter((m) => {
      if (!m || seen.has(m)) return false;
      seen.add(m);
      return true;
    });
}

export function maskApiKeyHint(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

export function normalizeProviderExtras(
  provider: ProviderId,
  raw?: Record<string, unknown> | null,
): Record<string, unknown> {
  const extras: Record<string, unknown> = { ...(raw ?? {}) };

  if (provider === "cloudflare") {
    const accountId =
      (typeof extras.accountId === "string" && extras.accountId.trim()) ||
      (typeof raw?.accountId === "string" && raw.accountId.trim()) ||
      "";
    if (!accountId) {
      throw new BadRequestException(
        "Cloudflare requiere accountId en extras (Account ID de tu cuenta Cloudflare)",
      );
    }
    extras.accountId = accountId;
  }

  return extras;
}

export function resolveConfigBaseUrl(
  provider: ProviderId,
  dtoBaseUrl: string | null | undefined,
  extras: Record<string, unknown>,
): string {
  const catalog = PROVIDER_CATALOG[provider];
  const trimmed = dtoBaseUrl?.trim();

  if (provider === "cloudflare") {
    const accountId = resolveCloudflareAccountId(extras, trimmed);
    if (!accountId) {
      throw new BadRequestException(
        "Cloudflare requiere accountId en extras o una baseUrl con /accounts/{id}/ai/v1",
      );
    }
    if (trimmed && !trimmed.includes("{accountId}")) {
      return trimmed;
    }
    return buildCloudflareBaseUrl(accountId);
  }

  return trimmed || catalog.defaultBaseUrl;
}

export function resolveRuntimeBaseUrl(
  provider: ProviderId,
  storedBaseUrl: string | null | undefined,
  extras: Record<string, unknown>,
): string {
  const catalog = PROVIDER_CATALOG[provider];
  const trimmed = storedBaseUrl?.trim();

  if (provider === "cloudflare") {
    const accountId = resolveCloudflareAccountId(extras, trimmed);
    if (accountId) {
      if (trimmed && !trimmed.includes("{accountId}")) {
        return trimmed;
      }
      return buildCloudflareBaseUrl(accountId);
    }
    throw new BadRequestException(
      "Configuración Cloudflare incompleta: falta accountId en extras",
    );
  }

  return trimmed || catalog.defaultBaseUrl;
}

export function buildModelFields(
  provider: ProviderId,
  dto: {
    chatModel?: string;
    chatModelFallbacks?: string[];
    embeddingModel?: string | null;
    embeddingDimension?: number | null;
    sttModel?: string | null;
  },
) {
  const catalog = PROVIDER_CATALOG[provider];
  const chatModel = dto.chatModel?.trim() || catalog.defaultChatModel;
  const chatModelFallbacks = normalizeFallbacks(dto.chatModelFallbacks);
  const embeddingModel =
    dto.embeddingModel === null
      ? null
      : (dto.embeddingModel?.trim() || catalog.defaultEmbeddingModel);
  const embeddingDimension =
    dto.embeddingDimension === null
      ? null
      : dto.embeddingDimension !== undefined
        ? dto.embeddingDimension
        : resolveEmbeddingDimensionForModel(provider, embeddingModel);
  const sttModel =
    dto.sttModel === null ? null : (dto.sttModel?.trim() || catalog.defaultSttModel);
  if (sttModel && !catalog.supportsStt) {
    throw new BadRequestException(`El proveedor «${provider}» no soporta transcripción de audio`);
  }
  return { chatModel, chatModelFallbacks, embeddingModel, embeddingDimension, sttModel };
}
