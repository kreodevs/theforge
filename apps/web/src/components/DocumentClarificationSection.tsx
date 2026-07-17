import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import type { ClarifyableDocumentField } from "@theforge/shared-types";
import {
  DOCUMENT_PERSIST_FIELD_LABELS,
  extractClarificationItems,
  hasPendingClarifications,
} from "@theforge/shared-types";
import { ResolveClarificationsPanel } from "@/components/ResolveClarificationsPanel";

export interface DocumentClarificationSectionProps {
  projectId: string;
  field: ClarifyableDocumentField;
  content: string | null;
  stageId?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  onContentApplied: (content: string) => void;
  onMessage?: (msg: string) => void;
  /** Estado controlado del diálogo (toolbar / bubble menu). */
  clarifyOpen?: boolean;
  onClarifyOpenChange?: (open: boolean) => void;
}

/**
 * Banner + modal de respuestas para `[NEEDS CLARIFICATION]` en cualquier entregable.
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
  clarifyOpen,
  onClarifyOpenChange,
}: DocumentClarificationSectionProps) {
  const documentLabel = DOCUMENT_PERSIST_FIELD_LABELS[field] ?? field;

  const pendingItems = useMemo(
    () => extractClarificationItems(content ?? ""),
    [content],
  );
  const hasPending = hasPendingClarifications(content ?? "");

  const trimmedContent = (content ?? "").trim();
  if (!trimmedContent || readOnly) return null;

  return (
    <>
      {hasPending ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_6%,var(--card))] px-3 py-2.5">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-[color-mix(in_oklch,var(--warning)_75%,var(--foreground))]">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <HelpCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {pendingItems.length} clarificación(es) pendiente(s) en {documentLabel}
            </span>
            . Responde para regenerar el documento sin marcadores.
          </p>
          <ResolveClarificationsPanel
            projectId={projectId}
            field={field}
            documentLabel={documentLabel}
            content={content ?? ""}
            stageId={stageId}
            disabled={disabled}
            onApplied={onContentApplied}
            onMessage={onMessage}
            open={clarifyOpen}
            onOpenChange={onClarifyOpenChange}
            showTrigger
            triggerVariant="button"
          />
        </div>
      ) : (
        <ResolveClarificationsPanel
          projectId={projectId}
          field={field}
          documentLabel={documentLabel}
          content={content ?? ""}
          stageId={stageId}
          disabled={disabled}
          onApplied={onContentApplied}
          onMessage={onMessage}
          open={clarifyOpen}
          onOpenChange={onClarifyOpenChange}
          showTrigger={false}
        />
      )}
    </>
  );
}
