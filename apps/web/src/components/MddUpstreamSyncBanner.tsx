import { AlertTriangle, GitMerge } from "lucide-react";
import type { MddUpstreamSyncStatus } from "@theforge/shared-types";
import { MDD_UPSTREAM_SOURCE_LABELS } from "@theforge/shared-types";
import { cn } from "@/lib/utils";
import { WorkshopPanelButton, WorkshopButtonIcon } from "@/components/WorkshopButtons";

export interface MddUpstreamSyncBannerProps {
  syncStatus: MddUpstreamSyncStatus | null | undefined;
  disabled?: boolean;
  onOpenSyncDialog: () => void;
}

/**
 * Aviso cuando DBGA/BRD/Benchmark cambiaron respecto al baseline del MDD persistido.
 */
export default function MddUpstreamSyncBanner({
  syncStatus,
  disabled = false,
  onOpenSyncDialog,
}: MddUpstreamSyncBannerProps) {
  if (!syncStatus?.pendingSync || !syncStatus.canSync) return null;

  const sources =
    syncStatus.changedSources?.map((s) => MDD_UPSTREAM_SOURCE_LABELS[s] ?? s).join(", ") ||
    "documentos upstream";

  return (
    <div
      className={cn(
        "shrink-0 border-b px-3 py-2 sm:px-4 sm:py-2.5",
        "border-[color-mix(in_oklch,var(--warning)_42%,var(--border))]",
        "bg-[color-mix(in_oklch,var(--warning)_14%,var(--card))]",
        "dark:bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))]",
      )}
      role="region"
      aria-label="Cambios upstream pendientes de reflejar en el MDD"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[color-mix(in_oklch,var(--warning)_70%,var(--foreground))] sm:mt-0"
            aria-hidden
          />
          <p className="min-w-0 text-sm leading-snug text-[var(--foreground)]">
            <span className="font-semibold">MDD desactualizado:</span> hay cambios en {sources} que no están reflejados
            en el MDD. Puedes sincronizar solo las secciones afectadas (§
            {(syncStatus.expandedSections ?? []).join(", §")}) o regenerar el documento completo.
          </p>
        </div>
        <WorkshopPanelButton tone="primary" disabled={disabled} onClick={onOpenSyncDialog}>
          <WorkshopButtonIcon icon={GitMerge} tone="primary" />
          Sincronizar MDD…
        </WorkshopPanelButton>
      </div>
    </div>
  );
}
