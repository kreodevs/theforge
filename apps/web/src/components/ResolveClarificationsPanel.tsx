import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, Loader2 } from "lucide-react";
import type { ClarifyableDocumentField } from "@theforge/shared-types";
import { extractClarificationItems } from "@theforge/shared-types";
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
import { useWorkshopStore } from "@/store/workshopStore";

export interface ResolveClarificationsPanelProps {
  projectId: string;
  field: ClarifyableDocumentField;
  documentLabel: string;
  content: string;
  stageId?: string | null;
  disabled?: boolean;
  onApplied: (content: string) => void;
  onMessage?: (msg: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  triggerVariant?: "icon" | "button";
}

/**
 * Diálogo para responder marcadores `[NEEDS CLARIFICATION]` existentes y regenerar el documento.
 */
export function ResolveClarificationsPanel({
  projectId,
  field,
  documentLabel,
  content,
  stageId,
  disabled,
  onApplied,
  onMessage,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  triggerVariant = "button",
}: ResolveClarificationsPanelProps) {
  const resolveClarifications = useWorkshopStore((s) => s.resolveClarifications);
  const loading = useWorkshopStore((s) => s.loading);

  const pendingItems = useMemo(
    () => extractClarificationItems(content ?? ""),
    [content],
  );
  const hasPending = pendingItems.length > 0;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setAnswers({});
    }
  }, [open]);

  const allAnswered =
    hasPending &&
    pendingItems.every((item) => (answers[item.id] ?? "").trim().length > 0);

  const handleResolve = async () => {
    if (!allAnswered || !projectId) return;
    setBusy(true);
    try {
      const payload: Record<string, string> = {};
      for (const item of pendingItems) {
        payload[item.id] = answers[item.id]!.trim();
      }
      const res = await resolveClarifications(projectId, {
        field,
        answers: payload,
        persist: true,
        stageId: stageId ?? undefined,
      });
      if (!res) return;
      onApplied(res.resolvedContent);
      setAnswers({});
      if (res.clarificationMarkerCount === 0) {
        onMessage?.(`✅ ${documentLabel} regenerado — todas las clarificaciones resueltas`);
      } else {
        onMessage?.(
          `${documentLabel} actualizado — quedan ${res.clarificationMarkerCount} marcador(es) pendientes`,
        );
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const triggerLabel = `Resolver clarificaciones (${documentLabel})`;

  return (
    <>
      {showTrigger && hasPending ? (
        triggerVariant === "button" ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled || !projectId}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] px-3 py-1.5 text-xs font-semibold text-[color-mix(in_oklch,var(--primary)_70%,var(--foreground))] disabled:opacity-50"
            aria-label={triggerLabel}
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Responder ({pendingItems.length})
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <WorkshopDocToolbarIconButton
                onClick={() => setOpen(true)}
                disabled={disabled || !projectId}
                aria-label={triggerLabel}
              >
                <HelpCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
              </WorkshopDocToolbarIconButton>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-[16rem]">
              Responde {pendingItems.length} clarificación(es) pendiente(s) en {documentLabel}
            </TooltipContent>
          </Tooltip>
        )
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl" className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Clarificaciones pendientes — {documentLabel}</DialogTitle>
            <DialogDescription>
              Responde los marcadores{" "}
              <code className="text-xs">[NEEDS CLARIFICATION]</code> ya presentes en el
              documento. Tras aplicar, el contenido se regenerará incorporando tus decisiones.
            </DialogDescription>
          </DialogHeader>

          {!hasPending ? (
            <p className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
              No hay marcadores{" "}
              <code className="text-[10px]">[NEEDS CLARIFICATION]</code> en este documento.
              Genera o edita el {documentLabel} para que la IA incluya preguntas abiertas donde
              haga falta tu decisión.
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {pendingItems.map((item, index) => (
                <li
                  key={item.id}
                  className="space-y-1 rounded-md border border-[color-mix(in_oklch,var(--warning)_25%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_4%,var(--card))] p-3"
                >
                  <label
                    className="block text-xs font-medium leading-relaxed text-[var(--foreground)]"
                    htmlFor={`resolve-answer-${field}-${item.id}`}
                  >
                    {index + 1}. {item.question}
                  </label>
                  <textarea
                    id={`resolve-answer-${field}-${item.id}`}
                    value={answers[item.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    rows={3}
                    disabled={disabled || busy || loading}
                    className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                    placeholder="Tu decisión / respuesta…"
                  />
                </li>
              ))}
            </ul>
          )}

          <DialogFooter className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              Cerrar
            </button>
            {hasPending ? (
              <button
                type="button"
                onClick={() => void handleResolve()}
                disabled={!allAnswered || disabled || busy || loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                )}
                Aplicar respuestas y regenerar
              </button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
