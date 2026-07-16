import { Loader2, Mic, Pencil, ScanEye, Sparkles, Star, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui";
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

function formatTimestamp(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-2 text-sm">
      <dt className="text-[var(--foreground-muted)]">{label}</dt>
      <dd className="min-w-0 break-all font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function OptionalModelRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string | null | undefined;
}) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_15%,var(--card))] px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--foreground-muted)]" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-[var(--foreground-muted)]">{label}</p>
        <p className="font-mono text-xs text-[var(--foreground)]">{trimmed}</p>
      </div>
    </div>
  );
}

export interface ProviderInstanceDetailPanelProps {
  instance: ProviderInstanceSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  isActive: boolean;
  isDeveloper: boolean;
  canMutate: boolean;
  activatingId: string | null;
  onSetActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditTier: (tier: ProviderModelTier) => void;
}

export function ProviderInstanceDetailPanel({
  instance,
  open,
  onOpenChange,
  loading = false,
  isActive,
  isDeveloper,
  canMutate,
  activatingId,
  onSetActive,
  onEdit,
  onDelete,
  onEditTier,
}: ProviderInstanceDetailPanelProps) {
  const effective = instance ? resolveEffectiveModelTiers(instance, null) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        className={cn(
          "flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg",
          "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[min(92dvh,680px)] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0",
          "max-sm:rounded-t-2xl max-sm:rounded-b-none",
        )}
      >
        <div
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--border)] sm:hidden"
          aria-hidden
        />
        <DialogHeader className="shrink-0 space-y-2 border-b border-[var(--border)] px-4 py-4 text-left sm:px-6">
          {instance ? (
            <div className="flex items-start gap-3">
              <ProviderLogo provider={instance.providerType} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-left text-base sm:text-lg">
                    {instance.displayName}
                  </DialogTitle>
                  {isActive ? (
                    <span className="shrink-0 rounded-md bg-[color-mix(in_oklch,var(--primary)_18%,var(--card))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                      Activa
                    </span>
                  ) : null}
                </div>
                <DialogDescription className="text-left">
                  {getProviderLabel(instance.providerType)} · {instance.slug}
                </DialogDescription>
              </div>
            </div>
          ) : (
            <DialogTitle>Detalle de instancia</DialogTitle>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--foreground-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Cargando detalle…
            </div>
          ) : instance && effective ? (
            <div className="space-y-5">
              <dl className="space-y-2">
                <DetailRow label="Nombre" value={instance.displayName} />
                <DetailRow label="Slug" value={instance.slug} />
                <DetailRow label="Proveedor" value={getProviderLabel(instance.providerType)} />
                <DetailRow label="URL base" value={instance.baseUrl?.trim() || "—"} />
                <DetailRow label="Clave API" value={instance.apiKeyHint?.trim() || "—"} />
                <DetailRow label="Creada" value={formatTimestamp(instance.createdAt)} />
                <DetailRow label="Actualizada" value={formatTimestamp(instance.updatedAt)} />
              </dl>

              <div className="space-y-2">
                <p className="text-sm font-medium text-[var(--foreground)]">Modelos por tier</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {PROVIDER_MODEL_TIER_ORDER.map((tier) => (
                    <ProviderTierCard
                      key={tier}
                      tier={tier}
                      modelId={effectiveModelForTier(tier, effective)}
                      inheritanceHint={providerTierInheritanceHint(tier, effective)}
                      showEdit={canMutate}
                      onEdit={() => onEditTier(tier)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <OptionalModelRow
                  icon={Sparkles}
                  label="Embeddings"
                  value={instance.embeddingModel}
                />
                <OptionalModelRow icon={Mic} label="Transcripción (STT)" value={instance.sttModel} />
                <OptionalModelRow
                  icon={ScanEye}
                  label="Visión"
                  value={instance.visionModel}
                />
              </div>
            </div>
          ) : null}
        </div>

        {instance ? (
          <div className="shrink-0 flex flex-col gap-2 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            {!isDeveloper && !isActive ? (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={activatingId === instance.id}
                onClick={onSetActive}
              >
                {activatingId === instance.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Star className="h-4 w-4" aria-hidden />
                )}
                Usar
              </Button>
            ) : isDeveloper && isActive ? (
              <span className="flex items-center justify-center px-3 py-2 text-sm text-[var(--foreground-muted)] sm:mr-auto">
                Predeterminado del equipo
              </span>
            ) : null}
            {canMutate ? (
              <>
                <Button type="button" variant="outline" className="gap-2" onClick={onEdit}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 text-[var(--destructive)] hover:text-[var(--destructive)]"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Eliminar
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
