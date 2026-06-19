import { useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { WorkshopDocToolbarIconButton } from "@/components/WorkshopButtons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

interface ClarifySpecPanelProps {
  projectId: string;
  disabled?: boolean;
  onClarify: (
    projectId: string,
    opts: { persist: boolean; notes?: string },
  ) => Promise<{ clarifiedSpec: string; clarificationMarkerCount: number } | null>;
  onApplied: (content: string) => void;
  onMessage?: (msg: string) => void;
}

/**
 * Pre-MDD clarify flow for Spec tab (`/speckit.clarify` equivalent).
 */
export function ClarifySpecPanel({
  projectId,
  disabled,
  onClarify,
  onApplied,
  onMessage,
}: ClarifySpecPanelProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleRun = async (persist: boolean) => {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await onClarify(projectId, {
        persist,
        notes: notes.trim() || undefined,
      });
      if (!res) return;
      setPreview(res.clarifiedSpec);
      if (persist) {
        onApplied(res.clarifiedSpec);
        onMessage?.(
          res.clarificationMarkerCount > 0
            ? `Spec aclarado — ${res.clarificationMarkerCount} [NEEDS CLARIFICATION] pendiente(s)`
            : "✅ Spec aclarado sin marcadores pendientes",
        );
        setOpen(false);
        setPreview(null);
        setNotes("");
      } else {
        onMessage?.(
          `Vista previa: ${res.clarificationMarkerCount} marcador(es) [NEEDS CLARIFICATION]`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <WorkshopDocToolbarIconButton
            onClick={() => setOpen(true)}
            disabled={disabled || !projectId}
            aria-label="Aclarar Spec antes del plan (speckit.clarify)"
          >
            <HelpCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
          </WorkshopDocToolbarIconButton>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-[16rem]">
          Aclarar Spec — marca ambigüedades con [NEEDS CLARIFICATION]
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl" className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Aclarar Spec</DialogTitle>
            <DialogDescription>
              Equivalente a <code className="text-xs">/speckit.clarify</code>: revisa el Spec con DBGA/BRD
              y marca dudas con <code className="text-xs">[NEEDS CLARIFICATION]</code>. No requiere MDD
              completo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block text-xs font-medium" htmlFor="clarify-notes">
              Notas opcionales para el clarificador
            </label>
            <textarea
              id="clarify-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
              placeholder="Ej. priorizar alcance MVP, aclarar integración con SSO…"
            />
            {preview ? (
              <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-2">
                <pre className="whitespace-pre-wrap text-xs">{preview.slice(0, 4000)}</pre>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleRun(false)}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Vista previa
            </button>
            <button
              type="button"
              onClick={() => void handleRun(true)}
              disabled={busy}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} Aplicar al Spec
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
