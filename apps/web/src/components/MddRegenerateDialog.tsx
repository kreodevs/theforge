import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, GitMerge } from "lucide-react";
import {
  MDD_SECTION_TITLES,
  MDD_UPSTREAM_SOURCE_LABELS,
  type MddUpstreamSyncStatus,
} from "@theforge/shared-types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

export type MddRegenerateMode = "full" | "upstream-sync";

export interface MddRegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Análisis desde generation-status o GET upstream-sync/analysis. */
  syncStatus: MddUpstreamSyncStatus | null | undefined;
  loading?: boolean;
  /** Modo inicial al abrir (p. ej. desde banner). */
  initialMode?: MddRegenerateMode;
  onConfirmFull: () => void | Promise<void>;
  onConfirmSync: (sections: number[]) => void | Promise<void>;
}

function toggleSection(set: Set<number>, section: number): Set<number> {
  const next = new Set(set);
  if (next.has(section)) next.delete(section);
  else next.add(section);
  return next;
}

export default function MddRegenerateDialog({
  open,
  onOpenChange,
  syncStatus,
  loading = false,
  initialMode = "full",
  onConfirmFull,
  onConfirmSync,
}: MddRegenerateDialogProps) {
  const canSync = syncStatus?.canSync === true && syncStatus.pendingSync !== false;
  const defaultSections = useMemo(
    () => syncStatus?.expandedSections?.length ? [...syncStatus.expandedSections] : [1, 2, 3, 4, 5, 6, 7],
    [syncStatus?.expandedSections],
  );

  const [mode, setMode] = useState<MddRegenerateMode>(initialMode);
  const [selectedSections, setSelectedSections] = useState<Set<number>>(() => new Set(defaultSections));

  useEffect(() => {
    if (!open) return;
    setMode(canSync && initialMode === "upstream-sync" ? "upstream-sync" : initialMode);
    setSelectedSections(new Set(defaultSections));
  }, [open, initialMode, canSync, defaultSections]);

  const sectionsSorted = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7].filter((n) => selectedSections.has(n)),
    [selectedSections],
  );

  const runConfirm = useCallback(async () => {
    if (mode === "upstream-sync") {
      if (sectionsSorted.length === 0) return;
      await onConfirmSync(sectionsSorted);
    } else {
      await onConfirmFull();
    }
  }, [mode, onConfirmFull, onConfirmSync, sectionsSorted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerar o sincronizar el MDD</DialogTitle>
          <DialogDescription>
            Elige regeneración completa desde DBGA/Benchmark o sincroniza solo las secciones afectadas por cambios
            upstream.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label
            className={cn(
              "flex gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/40",
              mode === "full" && "border-primary/50 bg-primary/5",
            )}
          >
            <input
              type="radio"
              name="mdd-regenerate-mode"
              className="mt-1 shrink-0"
              checked={mode === "full"}
              onChange={() => setMode("full")}
            />
            <span className="text-sm leading-snug">
              <span className="font-medium flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Regenerar MDD completo
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                Pipeline greenfield desde cero (Clarificador → §7). Usa cuando el MDD está desalineado o es la primera
                generación tras patrones.
              </span>
            </span>
          </label>

          <label
            className={cn(
              "flex gap-3 rounded-md border border-border/60 p-3",
              !canSync && "opacity-60 cursor-not-allowed",
              canSync && "cursor-pointer hover:bg-muted/40",
              mode === "upstream-sync" && canSync && "border-primary/50 bg-primary/5",
            )}
          >
            <input
              type="radio"
              name="mdd-regenerate-mode"
              className="mt-1 shrink-0"
              checked={mode === "upstream-sync"}
              disabled={!canSync}
              onChange={() => canSync && setMode("upstream-sync")}
            />
            <span className="text-sm leading-snug">
              <span className="font-medium flex items-center gap-1.5">
                <GitMerge className="h-3.5 w-3.5" aria-hidden />
                Sincronizar desde upstream
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {canSync
                  ? "Regenera solo §1–§7 afectadas por cambios en Fase 0, BRD o Benchmark; conserva el resto del MDD."
                  : syncStatus?.needsFullRegen
                    ? "Genera el MDD completo primero; luego podrás sincronizar cambios incrementales."
                    : "No hay cambios upstream pendientes respecto al baseline del MDD."}
              </span>
            </span>
          </label>

          {mode === "upstream-sync" && canSync && syncStatus?.changes?.length ? (
            <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs space-y-1.5">
              <p className="font-medium text-foreground">Cambios detectados</p>
              <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                {syncStatus.changes.map((c) => (
                  <li key={c.source}>
                    <span className="text-foreground">{c.label}</span>: {c.summary}
                  </li>
                ))}
              </ul>
              {syncStatus.changedSources?.length ? (
                <p className="text-[11px] text-muted-foreground">
                  Fuentes:{" "}
                  {syncStatus.changedSources.map((s) => MDD_UPSTREAM_SOURCE_LABELS[s] ?? s).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === "upstream-sync" && canSync ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-foreground">Secciones a sincronizar</legend>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <label
                    key={n}
                    className="flex items-center gap-2 rounded border border-border/40 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections.has(n)}
                      onChange={() => setSelectedSections((prev) => toggleSection(prev, n))}
                    />
                    {MDD_SECTION_TITLES[n] ?? `§${n}`}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void runConfirm()}
            disabled={
              loading || (mode === "upstream-sync" && (!canSync || sectionsSorted.length === 0))
            }
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> : null}
            {mode === "upstream-sync" ? "Sincronizar secciones" : "Regenerar completo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
