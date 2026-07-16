import type { LucideIcon } from "lucide-react";
import { Layers, MessageSquare, Sparkles } from "lucide-react";
import type { EffectiveModelTiers } from "@/utils/resolve-effective-provider";

/** Tiers de modelo mostrados en la UI de instancias (Premium / Estándar / Ligero). */
export type ProviderModelTier = "premium" | "estandar" | "ligero";

export const PROVIDER_MODEL_TIER_ORDER: ProviderModelTier[] = [
  "premium",
  "estandar",
  "ligero",
];

export type ProviderModelTierField =
  | "architectChatModel"
  | "graphChatModel"
  | "chatModel";

export const TIER_MODEL_FIELD: Record<ProviderModelTier, ProviderModelTierField> = {
  premium: "architectChatModel",
  estandar: "graphChatModel",
  ligero: "chatModel",
};

export const TIER_RESOLVE_KEY: Record<
  ProviderModelTier,
  keyof Pick<EffectiveModelTiers, "architect" | "graph" | "chat">
> = {
  premium: "architect",
  estandar: "graph",
  ligero: "chat",
};

export interface ProviderTierMeta {
  tier: ProviderModelTier;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  field: ProviderModelTierField;
}

export const PROVIDER_TIER_META: Record<ProviderModelTier, ProviderTierMeta> = {
  premium: {
    tier: "premium",
    label: "Premium",
    shortLabel: "Premium",
    icon: Sparkles,
    field: "architectChatModel",
  },
  estandar: {
    tier: "estandar",
    label: "Estándar",
    shortLabel: "Estándar",
    icon: Layers,
    field: "graphChatModel",
  },
  ligero: {
    tier: "ligero",
    label: "Ligero",
    shortLabel: "Ligero",
    icon: MessageSquare,
    field: "chatModel",
  },
};

/** Texto "hereda de …" cuando el tier no tiene modelo propio configurado. */
export function providerTierInheritanceHint(
  tier: ProviderModelTier,
  effective: EffectiveModelTiers,
): string | null {
  if (tier === "ligero") return null;
  const source =
    tier === "estandar" ? effective.graphSource : effective.architectSource;
  if (source === "configured") return null;
  if (tier === "estandar" && source === "chat-fallback") {
    return "Hereda de Ligero";
  }
  if (tier === "premium" && source === "graph-fallback") {
    return "Hereda de Estándar";
  }
  if (tier === "premium" && source === "chat-fallback") {
    return "Hereda de Ligero";
  }
  return null;
}

export function effectiveModelForTier(
  tier: ProviderModelTier,
  effective: EffectiveModelTiers,
): string | null {
  const key = TIER_RESOLVE_KEY[tier];
  return effective[key];
}
