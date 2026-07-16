import type { LucideIcon } from "lucide-react";
import { Rocket, Scale, Zap } from "lucide-react";
import type { EffectiveModelTierSource, EffectiveModelTiers } from "./resolve-effective-provider";
import { modelTierHint } from "./resolve-effective-provider";

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

export interface ResolvedProviderModelTierRow extends ProviderModelTierRowDef {
  model: string | null;
  displayModel: string | null;
  hint: string | null;
  source: EffectiveModelTierSource | null;
}

/** Strip OpenRouter-style `provider/model` prefix for compact card labels. */
export function formatModelShortLabel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return trimmed;
  const slashIdx = trimmed.lastIndexOf("/");
  if (slashIdx >= 0) {
    return trimmed.slice(slashIdx + 1);
  }
  return trimmed;
}

export interface ResolveProviderModelTierRowsOptions {
  /** When true, graph/architect fallback hints are included (e.g. chat popover). */
  showHints?: boolean;
}

export function resolveProviderModelTierRows(
  tiers: EffectiveModelTiers,
  options?: ResolveProviderModelTierRowsOptions,
): ResolvedProviderModelTierRow[] {
  const showHints = options?.showHints ?? false;

  return PROVIDER_MODEL_TIER_ROWS.map((row) => {
    const model = tiers[row.tier];
    if (row.tier === "chat") {
      return {
        ...row,
        model,
        displayModel: model ? formatModelShortLabel(model) : null,
        hint: null,
        source: null,
      };
    }
    const source = row.tier === "graph" ? tiers.graphSource : tiers.architectSource;
    return {
      ...row,
      model,
      displayModel: model ? formatModelShortLabel(model) : null,
      source,
      hint: showHints ? modelTierHint(row.tier, source) : null,
    };
  });
}
