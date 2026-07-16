import { useMemo, useState } from "react";
import { CheckCircle2, HelpCircle, Loader2 } from "lucide-react";
import type { ClarifyableDocumentField } from "@theforge/shared-types";
import {
  DOCUMENT_PERSIST_FIELD_LABELS,
  extractClarificationItems,
  hasPendingClarifications,
} from "@theforge/shared-types";
import { ClarifyDocumentPanel } from "@/components/ClarifyDocumentPanel";
import { useWorkshopStore } from "@/store/workshopStore";

export interface DocumentClarificationSectionProps {
  projectId: string;
  field: ClarifyableDocumentField;
  content: string | null;
  stageId?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  onContentApplied: (content: string) => void;
  onMessage?: (msg: string) => void;
  /** Texto breve del banner (opcional). */
  hint?: string;
  /** Estado controlado del diálogo «Aclarar» (toolbar / bubble menu). */
  clarifyOpen?: boolean;
  onClarifyOpenChange?: (open: boolean) => void;
}

/**
 * Banner + formulario de respuestas para `[NEEDS CLARIFICATION]` en cualquier entregable.
 */
export function DocumentClarificationSection({
  projectId,
  field,
  content,
  stageId,
  disabled,
  readOnly,
  onContentApplied,
  onMessage,
  hint,
  clarifyOpen,
  onClarifyOpenChange,
}: DocumentClarificationSectionProps) {
  const documentLabel = DOCUMENT_PERSIST_FIELD_LABELS[field] ?? field;
  const clarifyDocument = useWorkshopStore((s) => s.clarifyDocument);
  const resolveClarifications = useWorkshopStore((s) => s.resolveClarifications);
  const loading = useWorkshopStore((s) => s.loading);

  const pendingItems = useMemo(
    () => extractClarificationItems(content ?? ""),
    [content],
  );
  const hasPending = hasPendingClarifications(content ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resolveBusy, setResolveBusy] = useState(false);
  const [internalClarifyOpen, setInternalClarifyOpen] = useState(false);
  const clarifyDialogOpen = clarifyOpen ?? internalClarifyOpen;
  const setClarifyDialogOpen = onClarifyOpenChange ?? setInternalClarifyOpen;

  const trimmedContent = (content ?? "").trim();
  if (!trimmedContent || readOnly) return null;

  const allAnswered =
    pendingItems.length > 0 &&
    pendingItems.every((item) => (answers[item.id] ?? "").trim().length > 0);

  const handleResolve = async () => {
    if (!allAnswered) return;
    setResolveBusy(true);
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
      onContentApplied(res.resolvedContent);
      setAnswers({});
      if (res.clarificationMarkerCount === 0) {
        onMessage?.(`✅ ${documentLabel} regenerado — todas las clarificaciones resueltas`);
      } else {
        onMessage?.(
          `${documentLabel} actualizado — quedan ${res.clarificationMarkerCount} marcador(es) pendientes`,
        );
      }
    } finally {
      setResolveBusy(false);
    }
  };

  return (
    <div className="mb-3 flex shrink-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] px-3 py-2.5">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[color-mix(in_oklch,var(--primary)_62%,var(--foreground))]">
          {hasPending ? (
            <>
              <strong>Pendientes de clarificación ({pendingItems.length})</strong> en {documentLabel}.
              Responde abajo para regenerar el documento sin marcadores.
            </>
          ) : (
            <>
              <strong>Aclarar {documentLabel}</strong>
              {hint ? `: ${hint}` : ""} Marca ambigüedades con{" "}
              <code className="text-[10px]">[NEEDS CLARIFICATION]</code> (equivalente a{" "}
              <code className="text-[10px]">/speckit.clarify</code>).
            </>
          )}
        </p>
        <ClarifyDocumentPanel
          projectId={projectId}
          field={field}
          documentLabel={documentLabel}
          stageId={stageId}
          disabled={disabled || loading}
          onClarify={clarifyDocument}
          onApplied={onContentApplied}
          onMessage={onMessage}
          open={clarifyDialogOpen}
          onOpenChange={setClarifyDialogOpen}
          showTrigger
          triggerVariant="button"
          allowSyncMdd={field === "specContent"}
        />
      </div>

      {hasPending ? (
        <div
          className="rounded-lg border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_6%,var(--card))] px-3 py-3"
          role="region"
          aria-label="Pendientes de clarificación"
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))]">
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Responde para regenerar {documentLabel}
          </div>
          <ul className="space-y-3">
            {pendingItems.map((item) => (
              <li key={item.id} className="space-y-1">
                <label
                  className="block text-xs leading-relaxed text-[var(--foreground)]"
                  htmlFor={`clarify-answer-${field}-${item.id}`}
                >
                  {item.question}
                </label>
                <textarea
                  id={`clarify-answer-${field}-${item.id}`}
                  value={answers[item.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  rows={2}
                  disabled={disabled || resolveBusy}
                  className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                  placeholder="Tu decisión / respuesta…"
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={!allAnswered || disabled || resolveBusy || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {resolveBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              )}
              Aplicar respuestas y regenerar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
