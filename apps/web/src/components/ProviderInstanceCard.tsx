import { Loader2 } from "lucide-react";
import { ProviderLogo, getProviderLabel } from "@/components/ProviderLogo";
import { ProviderTierCard } from "@/components/ProviderTierCard";
import {
  PROVIDER_MODEL_TIER_ORDER,
  effectiveModelForTier,
  providerTierInheritanceHint,
  type ProviderModelTier,
} from "@/utils/provider-tier-labels";
import { resolveEffectiveModelTiers } from "@/utils/resolve-effective-provider";
import type { ProviderInstanceSummary } from "@/types/user-providers";
import { cn } from "@/lib/utils";

export interface ProviderInstanceCardProps {
  inst: ProviderInstanceSummary;
  isActive: boolean;
  isSuperAdmin: boolean;
  canManage: boolean;
  canMutate: boolean;
  togglingId: string | null;
  onToggleVisibleForTeam: () => void;
  onSelect: () => void;
  onEditTier: (tier: ProviderModelTier) => void;
}

export function ProviderInstanceCard({
  inst,
  isActive,
  isSuperAdmin,
  canManage,
  canMutate,
  togglingId,
  onToggleVisibleForTeam,
  onSelect,
  onEditTier,
}: ProviderInstanceCardProps) {
  const providerLabel = getProviderLabel(inst.providerType);
  const effective = resolveEffectiveModelTiers(inst, null);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-[var(--card)] text-left shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all",
        "hover:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] hover:shadow-[0_8px_30px_rgba(0,0,0,0.14)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        isActive
          ? "border-[color-mix(in_oklch,var(--primary)_50%,var(--border))] ring-1 ring-[var(--primary)]/20"
          : "border-[var(--border)]",
      )}
    >
      {isActive ? (
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--primary)]" aria-hidden />
      ) : null}

      <div className="flex items-start gap-3 p-4 pl-5">
        <ProviderLogo provider={inst.providerType} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--foreground)] sm:text-[15px]">
              {inst.displayName}
            </p>
            {isActive ? (
              <span className="shrink-0 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary-foreground)] sm:rounded-md sm:bg-[color-mix(in_oklch,var(--primary)_18%,var(--card))] sm:text-[var(--primary)]">
                Activa
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--foreground-muted)]">{providerLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 pb-4 pl-5">
        {PROVIDER_MODEL_TIER_ORDER.map((tier) => (
          <ProviderTierCard
            key={tier}
            tier={tier}
            modelId={effectiveModelForTier(tier, effective)}
            inheritanceHint={providerTierInheritanceHint(tier, effective)}
            compact
            showEdit={canMutate}
            onEdit={() => onEditTier(tier)}
          />
        ))}
      </div>

      {isSuperAdmin && canManage ? (
        <div
          className="flex items-center justify-between border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-2.5 pl-5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-[var(--foreground-muted)]">Visible para el equipo</span>
          <label className="flex cursor-pointer items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={inst.enabledForUsers}
              aria-label="Visible para el equipo"
              disabled={togglingId === inst.id}
              onClick={onToggleVisibleForTeam}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50",
                inst.enabledForUsers
                  ? "bg-[var(--primary)]"
                  : "bg-[color-mix(in_oklch,var(--muted-foreground)_25%,var(--border))]",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                  inst.enabledForUsers ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
            {togglingId === inst.id ? (
              <Loader2 className="h-3 w-3 animate-spin text-[var(--foreground-muted)]" aria-hidden />
            ) : null}
          </label>
        </div>
      ) : null}
    </article>
  );
}
