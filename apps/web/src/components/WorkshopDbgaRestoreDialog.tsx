/**
 * Modal para restaurar versiones anteriores del DBGA (Fase 0) desde snapshots automáticos.
 */
import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { API_BASE, apiFetch } from "@/utils/apiClient";
import { cn } from "@/lib/utils";

export type DocumentSnapshotListItem = {
  id: string;
  projectId: string;
  field: string;
  contentLength: number;
  source: string;
  createdAt: string;
  preview: string;
  user?: { id: string; name: string | null; email: string };
};

const SOURCE_LABELS: Record<string, string> = {
  patch: "Edición en panel",
  chat: "Chat / orquestador",
  restore: "Restauración previa",
  salvage: "Recuperación desde chat",
  generation: "Generación automática",
};

function formatSnapshotDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatBytes(chars: number): string {
  if (chars < 1000) return `${chars} caracteres`;
  return `${(chars / 1000).toFixed(1)}k caracteres`;
}

export interface WorkshopDbgaRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onRestored: () => void | Promise<void>;
}

export function WorkshopDbgaRestoreDialog({
  open,
  onOpenChange,
  projectId,
  onRestored,
}: WorkshopDbgaRestoreDialogProps) {
  const [snapshots, setSnapshots] = useState<DocumentSnapshotListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    if (!projectId?.trim()) return;
    setLoadingList(true);
    setListError(null);
    try {
      const r = await apiFetch(
        `${API_BASE}/projects/${projectId.trim()}/document-snapshots?field=dbgaContent&limit=20`,
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo cargar el historial de versiones.");
      }
      const data = (await r.json()) as DocumentSnapshotListItem[];
      setSnapshots(Array.isArray(data) ? data : []);
    } catch (err) {
      setSnapshots([]);
      setListError(err instanceof Error ? err.message : "Error al cargar versiones.");
    } finally {
      setLoadingList(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) {
      void loadSnapshots();
    }
    if (!open) {
      setPendingId(null);
      setConfirmOpen(false);
      setRestoreError(null);
    }
  }, [open, projectId, loadSnapshots]);

  const pendingSnapshot = snapshots.find((s) => s.id === pendingId) ?? null;

  async function handleRestore() {
    if (!projectId?.trim() || !pendingId) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const r = await apiFetch(
        `${API_BASE}/projects/${projectId.trim()}/document-snapshots/${pendingId}/restore`,
        { method: "POST" },
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "No se pudo restaurar la versión.");
      }
      setConfirmOpen(false);
      setPendingId(null);
      onOpenChange(false);
      await onRestored();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Error al restaurar.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(88vh,640px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
          <div className="border-b border-[var(--border)] px-5 pb-4 pt-5 sm:px-6">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))]"
                  aria-hidden
                >
                  <History className="h-5 w-5 text-[var(--primary)]" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold">Versiones anteriores del DBGA</DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed">
                    Copias guardadas automáticamente antes de cada cambio. Restaurar reemplaza el
                    documento actual (se guarda una copia de seguridad previa).
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-[12rem] overflow-y-auto px-5 py-4 sm:px-6">
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Cargando historial…
              </div>
            ) : listError ? (
              <p className="text-sm text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]">
                {listError}
              </p>
            ) : snapshots.length === 0 ? (
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                Aún no hay versiones guardadas. Tras el próximo deploy, cada edición del DBGA creará
                una copia automática aquí.
              </p>
            ) : (
              <ul className="space-y-2" role="list">
                {snapshots.map((snap) => (
                  <li key={snap.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-left",
                        "transition-colors hover:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))]",
                        "hover:bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                      )}
                      onClick={() => {
                        setPendingId(snap.id);
                        setConfirmOpen(true);
                        setRestoreError(null);
                      }}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {formatSnapshotDate(snap.createdAt)}
                        </span>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatBytes(snap.contentLength)} ·{" "}
                          {SOURCE_LABELS[snap.source] ?? snap.source}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                        {snap.preview || "—"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {restoreError ? (
              <p className="mt-3 text-sm text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]">
                {restoreError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t border-[var(--border)] px-5 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" variant="secondary" disabled={loadingList || !projectId} onClick={() => void loadSnapshots()}>
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar esta versión?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <p>
                  El DBGA actual se reemplazará por la copia del{" "}
                  {pendingSnapshot ? formatSnapshotDate(pendingSnapshot.createdAt) : "snapshot seleccionado"}.
                </p>
                <p>Se guardará una copia del documento actual antes de restaurar.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={restoring} onClick={(e) => {
              e.preventDefault();
              void handleRestore();
            }}>
              {restoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Restaurando…
                </>
              ) : (
                "Restaurar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
