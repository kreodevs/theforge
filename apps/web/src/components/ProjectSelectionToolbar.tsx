import { Copy, GitMerge, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ProjectSelectionToolbarProps {
  selectedCount: number;
  loading?: boolean;
  isAdmin?: boolean;
  showMerge: boolean;
  showClone: boolean;
  showRename: boolean;
  cloneLoading?: boolean;
  renameLoading?: boolean;
  onClearSelection: () => void;
  onClone?: () => void;
  onRename?: () => void;
  onMerge?: () => void;
  onDelete?: () => void;
}

/**
 * Floating bulk-action bar for multi-select on the project dashboard.
 */
export function ProjectSelectionToolbar({
  selectedCount,
  loading = false,
  isAdmin = false,
  showMerge,
  showClone,
  showRename,
  cloneLoading = false,
  renameLoading = false,
  onClearSelection,
  onClone,
  onRename,
  onMerge,
  onDelete,
}: ProjectSelectionToolbarProps) {
  if (selectedCount <= 0) return null;

  const selectionLabel =
    selectedCount === 1 ? "carpeta seleccionada" : "carpetas seleccionadas";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4"
      role="presentation"
    >
      <div
        role="toolbar"
        aria-label="Acciones para carpetas seleccionadas"
        className={cn(
          "pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border sm:gap-3",
          "border-[color-mix(in_oklch,var(--primary)_20%,var(--border))]",
          "bg-[color-mix(in_oklch,var(--card)_94%,var(--background))]",
          "px-2 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.28),inset_0_1px_0_color-mix(in_oklch,var(--foreground)_7%,transparent)]",
          "backdrop-blur-xl sm:px-3 sm:py-2.5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[13rem] sm:flex-none">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--primary)_14%,var(--card))] text-sm font-bold tabular-nums text-[var(--primary)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_24%,transparent)]"
            aria-hidden
          >
            {selectedCount}
          </span>
          <p className="min-w-0 truncate text-sm font-medium leading-snug text-[var(--foreground)]">
            <span className="hidden min-[420px]:inline">{selectionLabel}</span>
            <span className="min-[420px]:hidden">sel.</span>
          </p>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={loading}
            className={cn(
              "ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors sm:ml-0 sm:hidden",
              "border-transparent text-[var(--muted-foreground)] hover:bg-[color-mix(in_oklch,var(--muted)_55%,transparent)] hover:text-[var(--foreground)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
            aria-label="Quitar selección"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div
          className="hidden h-8 w-px shrink-0 bg-[color-mix(in_oklch,var(--border)_90%,transparent)] sm:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={loading}
            className="hidden shrink-0 touch-manipulation sm:inline-flex"
          >
            Quitar selección
          </Button>

          {showClone && onClone ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClone}
              disabled={loading || cloneLoading}
              className="shrink-0 touch-manipulation"
              aria-label="Clonar carpeta seleccionada"
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Clonar</span>
            </Button>
          ) : null}

          {showRename && onRename ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRename}
              disabled={loading || renameLoading}
              className="shrink-0 touch-manipulation"
              aria-label="Renombrar carpeta seleccionada"
            >
              <Pencil className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Renombrar</span>
            </Button>
          ) : null}

          {showMerge && onMerge ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onMerge}
              disabled={loading}
              className="shrink-0 touch-manipulation shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <GitMerge className="h-4 w-4 shrink-0" aria-hidden />
              Fusionar
            </Button>
          ) : null}

          {isAdmin && onDelete ? (
            <>
              <div
                className="mx-0.5 hidden h-6 w-px shrink-0 bg-[color-mix(in_oklch,var(--border)_90%,transparent)] sm:block"
                aria-hidden
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={loading}
                className="shrink-0 touch-manipulation"
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                Borrar
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
