import { Pencil } from "lucide-react";
import { ListRowIconButton } from "@/components/ListRowIconButton";
import {
  PROVIDER_TIER_META,
  type ProviderModelTier,
} from "@/utils/provider-tier-labels";
import { cn } from "@/lib/utils";

export interface ProviderTierCardProps {
  tier: ProviderModelTier;
  modelId: string | null;
  inheritanceHint?: string | null;
  compact?: boolean;
  showEdit?: boolean;
  onEdit?: () => void;
  className?: string;
}

export function ProviderTierCard({
  tier,
  modelId,
  inheritanceHint,
  compact = false,
  showEdit = false,
  onEdit,
  className,
}: ProviderTierCardProps) {
  const meta = PROVIDER_TIER_META[tier];
  const Icon = meta.icon;
  const displayModel = modelId?.trim() || "—";

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_18%,var(--card))]",
        compact ? "gap-1 p-2" : "gap-1.5 p-2.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon
            className={cn(
              "shrink-0 text-[var(--primary)]",
              compact ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            strokeWidth={2}
            aria-hidden
          />
          <span
            className={cn(
              "truncate font-medium text-[var(--foreground)]",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {meta.label}
          </span>
        </div>
        {showEdit && onEdit ? (
          <ListRowIconButton
            tooltip={`Editar modelo ${meta.label}`}
            className="h-7 w-7 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </ListRowIconButton>
        ) : null}
      </div>
      <p
        className={cn(
          "truncate font-mono leading-tight text-[var(--foreground)]",
          compact ? "text-[10px]" : "text-[11px]",
        )}
        title={displayModel}
      >
        {displayModel}
      </p>
      {inheritanceHint ? (
        <p
          className={cn(
            "truncate text-[var(--foreground-muted)]",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          {inheritanceHint}
        </p>
      ) : null}
    </div>
  );
}
