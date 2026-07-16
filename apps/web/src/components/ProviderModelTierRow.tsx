import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROVIDER_TIER_ICON_TONE_CLASSES,
  type ProviderTierIconTone,
} from "@/utils/provider-model-tier-labels";

export interface ProviderModelTierRowProps {
  icon: LucideIcon;
  iconTone: ProviderTierIconTone;
  title: string;
  badge: string;
  trailing: React.ReactNode;
  error?: string;
  className?: string;
}

/** Shared tier row chrome: icon, title + badge inline, trailing slot on the right. */
export function ProviderModelTierRow({
  icon: Icon,
  iconTone,
  title,
  badge,
  trailing,
  error,
  className,
}: ProviderModelTierRowProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2.5 rounded-lg border border-[color-mix(in_oklch,var(--border)_72%,transparent)] bg-[color-mix(in_oklch,var(--muted)_16%,var(--card))] px-2.5 py-2">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            PROVIDER_TIER_ICON_TONE_CLASSES[iconTone],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-xs font-semibold text-[var(--foreground)]">{title}</span>
          <span className="shrink-0 rounded-md bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] px-1.5 py-0.5 text-[10px] font-medium text-[var(--foreground-muted)]">
            {badge}
          </span>
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
    <span
      title={model ?? undefined}
      className="min-w-0 max-w-[45%] shrink-0 truncate text-right font-mono text-xs text-[var(--foreground)]"
    >
      {displayModel ?? "—"}
    </span>
  );
}
