import type { LucideIcon } from "lucide-react";
import { Rocket, Scale, Zap } from "lucide-react";
import type { EffectiveModelTierSource, EffectiveModelTiers } from "./resolve-effective-provider";

export type ProviderModelTier = "architect" | "graph" | "chat";

/** Agentes y funciones que resuelven cada tier (MDD lean). */
export const PROVIDER_TIER_USAGE: Record<ProviderModelTier, string> = {
  chat:
    "Chat Workshop, Clasificador de intención, Mensaje de bienvenida, Decisiones de arquitectura",
  graph:
    "Alcance del proyecto, Orquestador, Seguridad, Infraestructura, Calidad del documento, Entregables (spec, blueprint…), Tareas de implementación",
  architect: "Arquitecto, Coordinador legacy",
};

export const PROVIDER_TIER_FORM_LABELS = {
  architect: "Alto rendimiento",
  graph: "Rendimiento estándar",
  chat: "Bajo rendimiento",
} as const;

export const PROVIDER_TIER_BADGES = {
  architect: "Premium",
  graph: "Estándar",
  chat: "Ligero",
} as const;

export type ProviderTierIconTone = "warning" | "info" | "success";

export interface ProviderModelTierRowDef {
  tier: "architect" | "graph" | "chat";
  title: string;
  badge: string;
  icon: LucideIcon;
  iconTone: ProviderTierIconTone;
}

export const PROVIDER_MODEL_TIER_ROWS: ProviderModelTierRowDef[] = [
  {
    tier: "architect",
    title: PROVIDER_TIER_FORM_LABELS.architect,
    badge: PROVIDER_TIER_BADGES.architect,
    icon: Rocket,
    iconTone: "warning",
  },
  {
    tier: "graph",
    title: PROVIDER_TIER_FORM_LABELS.graph,
    badge: PROVIDER_TIER_BADGES.graph,
    icon: Scale,
    iconTone: "info",
  },
  {
    tier: "chat",
    title: PROVIDER_TIER_FORM_LABELS.chat,
    badge: PROVIDER_TIER_BADGES.chat,
    icon: Zap,
    iconTone: "success",
  },
];

export const PROVIDER_TIER_ICON_TONE_CLASSES: Record<ProviderTierIconTone, string> = {
  warning:
    "text-[var(--warning)] bg-[color-mix(in_oklch,var(--warning)_18%,var(--card))]",
  info: "text-[var(--info)] bg-[color-mix(in_oklch,var(--info)_18%,var(--card))]",
  success:
    "text-[var(--success)] bg-[color-mix(in_oklch,var(--success)_18%,var(--card))]",
};

function tierUsageHint(tier: ProviderModelTier): string {
  return `Usado en: ${PROVIDER_TIER_USAGE[tier]}`;
}

/** Hint de card/panel: uso del tier y, si aplica, herencia de otro tier. */
export function providerTierHint(
  tier: ProviderModelTier,
  source?: EffectiveModelTierSource | null,
): string {
  const usage = tierUsageHint(tier);
  if (tier === "chat" || source === "configured" || !source) {
    return usage;
  }
  if (source === "graph-fallback") {
    return `Hereda de grafo · ${usage}`;
  }
  return `Hereda de chat · ${usage}`;
}

export const PROVIDER_TIER_FORM_HINTS: Record<ProviderModelTier, string> = {
  architect: `${tierUsageHint("architect")}. Vacío → hereda grafo o chat.`,
  graph: `${tierUsageHint("graph")}. Vacío → hereda chat.`,
  chat: `${tierUsageHint("chat")}. Obligatorio.`,
};

export interface ResolvedProviderModelTierRow extends ProviderModelTierRowDef {
  model: string | null;
  hint: string | null;
  source: EffectiveModelTierSource | null;
}

export function resolveProviderModelTierRows(
  tiers: EffectiveModelTiers,
): ResolvedProviderModelTierRow[] {
  return PROVIDER_MODEL_TIER_ROWS.map((row) => {
    const model = tiers[row.tier];
    const source =
      row.tier === "chat"
        ? null
        : row.tier === "graph"
          ? tiers.graphSource
          : tiers.architectSource;
    return {
      ...row,
      model,
      source,
      hint: providerTierHint(row.tier, source),
    };
  });
}
