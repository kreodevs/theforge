import { Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ListRowIconButton } from "@/components/ListRowIconButton";
import { ProviderLogo, getProviderLabel } from "@/components/ProviderLogo";
import type { ProviderInstanceSummary } from "@/types/user-providers";
import { ProviderModelTierReadonlyValue, ProviderModelTierRow } from "@/components/ProviderModelTierRow";
import { resolveProviderModelTierRows } from "@/utils/provider-model-tier-labels";
import { resolveEffectiveModelTiers } from "@/utils/resolve-effective-provider";
import { cn } from "@/lib/utils";

export interface ProviderInstanceCardProps {
  inst: ProviderInstanceSummary;
  isActive: boolean;
  isDeveloper: boolean;
  isSuperAdmin: boolean;
  canManage: boolean;
  canMutate: boolean;
  togglingId: string | null;
  activatingId: string | null;
  onToggleVisibleForTeam: () => void;
  onSetActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ModelPill({ model }: { model: string }) {
  return (
    <span
      title={model}
      className="inline-flex max-w-[min(100%,14rem)] shrink-0 items-center rounded-full border border-[color-mix(in_oklch,var(--border)_80%,transparent)] bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] px-2.5 py-1 font-mono text-[10px] leading-tight text-[var(--foreground)]"
    >
      <span className="truncate">{model}</span>
    </span>
  );
}

function ConfiguredModelsSection({ inst }: { inst: ProviderInstanceSummary }) {
  const tierRows = resolveProviderModelTierRows(resolveEffectiveModelTiers(inst, null));

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
        Modelos configurados
      </p>
      <ul className="space-y-2">
        {tierRows.map((row) => (
          <li key={row.tier}>
            <ProviderModelTierRow
              icon={row.icon}
              iconTone={row.iconTone}
              title={row.title}
              badge={row.badge}
              trailing={
                <ProviderModelTierReadonlyValue model={row.model} displayModel={row.displayModel} />
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardHeader({
  inst,
  isActive,
  canMutate,
  onEdit,
  showMainModelPill = true,
}: {
  inst: ProviderInstanceSummary;
  isActive: boolean;
  canMutate: boolean;
  onEdit: () => void;
  showMainModelPill?: boolean;
}) {
  const providerLabel = getProviderLabel(inst.providerType);

  return (
    <div className="flex items-start gap-3">
      <ProviderLogo provider={inst.providerType} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">
            {inst.displayName}
          </p>
          {isActive ? (
            <span className="shrink-0 rounded-md bg-[color-mix(in_oklch,var(--primary)_18%,var(--card))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
              Activa
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-[var(--foreground-muted)]">{providerLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 self-start">
        {showMainModelPill && inst.chatModel ? (
          <ModelPill model={inst.chatModel} />
        ) : null}
        {canMutate ? (
          <ListRowIconButton tooltip="Editar instancia" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </ListRowIconButton>
        ) : null}
      </div>
    </div>
  );
}

/** Mobile: stacked card with model tiers and bottom action bar. */
export function ProviderInstanceCardMobile(props: ProviderInstanceCardProps) {
  const {
    inst,
    isActive,
    isDeveloper,
    isSuperAdmin,
    canManage,
    canMutate,
    togglingId,
    activatingId,
    onToggleVisibleForTeam,
    onSetActive,
    onEdit,
    onDelete,
  } = props;
  const showUseAction = !isDeveloper && !isActive;
  const actionCols =
    (showUseAction ? 1 : 0) + (isDeveloper && isActive ? 1 : 0) + (canMutate ? 2 : 0);
  const actionGridClass =
    actionCols === 1
      ? "grid-cols-1"
      : actionCols === 2
        ? "grid-cols-2"
        : actionCols === 3
          ? "grid-cols-3"
          : "grid-cols-4";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-[var(--card)] shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:hidden",
        isActive
          ? "border-[color-mix(in_oklch,var(--primary)_55%,var(--border))] ring-1 ring-[var(--primary)]/25"
          : "border-[var(--border)]",
      )}
    >
      <div className="space-y-4 p-4">
        <CardHeader inst={inst} isActive={isActive} canMutate={canMutate} onEdit={onEdit} />
        <ConfiguredModelsSection inst={inst} />
        {isSuperAdmin && canManage ? (
          <label className="flex cursor-pointer items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={inst.enabledForUsers}
              aria-label="Visible para el equipo"
              disabled={togglingId === inst.id}
              onClick={onToggleVisibleForTeam}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50",
                inst.enabledForUsers
                  ? "bg-[var(--primary)]"
                  : "bg-[color-mix(in_oklch,var(--muted-foreground)_25%,var(--border))]",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  inst.enabledForUsers ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
            <span className="text-xs text-[var(--foreground-muted)]">Visible para el equipo</span>
            {togglingId === inst.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
          </label>
        ) : null}
      </div>

      <div
        className={cn(
          "grid border-t border-[var(--border)]",
          actionCols > 0 ? cn(actionGridClass, "divide-x divide-[var(--border)]") : "hidden",
        )}
      >
        {showUseAction ? (
          <button
            type="button"
            disabled={activatingId === inst.id}
            onClick={onSetActive}
            className="flex min-h-[3rem] flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-[var(--foreground-muted)] transition-colors active:bg-[var(--muted)]"
          >
            {activatingId === inst.id ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Star className="h-5 w-5" aria-hidden />
            )}
            Usar
          </button>
        ) : isDeveloper && isActive ? (
          <div className="flex min-h-[3rem] items-center justify-center px-3 py-2.5 text-xs font-medium text-[var(--foreground-muted)]">
            Predeterminado del equipo
          </div>
        ) : null}
        {canMutate ? (
          <>
            <button
              type="button"
              className="flex min-h-[3rem] flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-[var(--foreground-muted)] active:bg-[var(--muted)]"
              onClick={onEdit}
            >
              <Pencil className="h-5 w-5" aria-hidden />
              Editar
            </button>
            <button
              type="button"
              className="flex min-h-[3rem] flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-[var(--destructive)] active:bg-[var(--destructive)]/10"
              onClick={onDelete}
            >
              <Trash2 className="h-5 w-5" aria-hidden />
              Eliminar
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

/** Desktop: grid card with header, configured models, and inline actions. */
export function ProviderInstanceCardDesktop(props: ProviderInstanceCardProps) {
  const {
    inst,
    isActive,
    isDeveloper,
    isSuperAdmin,
    canManage,
    canMutate,
    togglingId,
    activatingId,
    onToggleVisibleForTeam,
    onSetActive,
    onEdit,
    onDelete,
  } = props;

  return (
    <article
      className={cn(
        "group relative hidden flex-col overflow-hidden rounded-xl border bg-[var(--card)] transition-all sm:flex",
        "hover:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
        isActive
          ? "border-[color-mix(in_oklch,var(--primary)_50%,var(--border))] shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent)]"
          : "border-[var(--border)]",
      )}
    >
      {isActive ? (
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--primary)]" aria-hidden />
      ) : null}

      <div className="space-y-4 p-4 pl-5">
        <CardHeader inst={inst} isActive={isActive} canMutate={canMutate} onEdit={onEdit} />
        <ConfiguredModelsSection inst={inst} />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {!isDeveloper && !isActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-3"
              disabled={activatingId === inst.id}
              onClick={onSetActive}
            >
              {activatingId === inst.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Star className="h-3.5 w-3.5" aria-hidden />
              )}
              Usar
            </Button>
          ) : isDeveloper && isActive ? (
            <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground-muted)]">
              Predeterminado del equipo
            </span>
          ) : (
            <span />
          )}
          {canMutate ? (
            <ListRowIconButton
              tooltip="Eliminar instancia"
              className="text-[var(--destructive)] hover:text-[var(--destructive)]"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </ListRowIconButton>
          ) : null}
        </div>
      </div>

      {isSuperAdmin && canManage ? (
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))] px-4 py-2.5 pl-5">
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
