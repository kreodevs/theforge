import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROVIDER_TIER_BADGE_CLASSES,
  PROVIDER_TIER_ICON_TONE_CLASSES,
  type ProviderTierIconTone,
} from "@/utils/provider-model-tier-labels";

export interface ProviderModelTierRowProps {
  icon: LucideIcon;
  iconTone: ProviderTierIconTone;
  title: string;
  badge: string;
  trailing?: React.ReactNode;
  error?: string;
  className?: string;
  layout?: "row" | "column";
}

function TierBadge({ badge, iconTone }: { badge: string; iconTone: ProviderTierIconTone }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        PROVIDER_TIER_BADGE_CLASSES[iconTone],
      )}
    >
      {badge}
    </span>
  );
}

function TierIcon({ icon: Icon, iconTone }: { icon: LucideIcon; iconTone: ProviderTierIconTone }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        PROVIDER_TIER_ICON_TONE_CLASSES[iconTone],
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Shared tier row chrome: icon, title + badge, optional trailing slot. */
export function ProviderModelTierRow({
  icon,
  iconTone,
  title,
  badge,
  trailing,
  error,
  className,
  layout = "row",
}: ProviderModelTierRowProps) {
  if (layout === "column") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-start gap-2">
          <TierIcon icon={icon} iconTone={iconTone} />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold leading-tight text-[var(--foreground)]">{title}</p>
            <TierBadge badge={badge} iconTone={iconTone} />
          </div>
        </div>
        {trailing}
        {error ? (
          <p className="text-xs text-[var(--destructive)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2.5 rounded-lg border border-[color-mix(in_oklch,var(--border)_72%,transparent)] bg-[color-mix(in_oklch,var(--muted)_16%,var(--card))] px-2.5 py-2">
        <TierIcon icon={icon} iconTone={iconTone} />
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--foreground)]">{title}</span>
          <TierBadge badge={badge} iconTone={iconTone} />
        </div>
        {trailing}
      </div>
      {error ? (
        <p className="px-1 text-xs text-[var(--destructive)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProviderModelTierReadonlyValue({
  model,
  displayModel,
}: {
  model: string | null;
  displayModel: string | null;
}) {
  return (
    <p
      title={model ?? undefined}
      className="min-w-0 font-mono text-[11px] leading-snug text-[var(--foreground-muted)]"
    >
      <span aria-hidden>• </span>
      <span className="text-[var(--foreground)]">{displayModel ?? "—"}</span>
    </p>
  );
}

/** Read-only tier column for provider instance cards (3-column grid). */
export function ProviderModelTierColumn({
  icon,
  iconTone,
  title,
  badge,
  model,
  displayModel,
  className,
}: {
  icon: LucideIcon;
  iconTone: ProviderTierIconTone;
  title: string;
  badge: string;
  model: string | null;
  displayModel: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 px-3 py-1 first:pl-0 last:pr-0", className)}>
      <div className="flex items-start gap-2">
        <TierIcon icon={icon} iconTone={iconTone} />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold leading-tight text-[var(--foreground)]">{title}</p>
          <TierBadge badge={badge} iconTone={iconTone} />
        </div>
      </div>
      <ProviderModelTierReadonlyValue model={model} displayModel={displayModel} />
    </div>
  );
}
