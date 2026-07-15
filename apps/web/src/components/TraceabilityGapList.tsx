import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, Loader2, Plus, X } from "lucide-react";
import type { TraceabilitySuggestFixResponse } from "@theforge/shared-types";
import { useWorkshopStore, type CrossDocumentGap } from "../store/workshopStore";

const SUGGEST_TIMEOUT_MS = 60_000;

const TARGET_SECTION_LABEL: Record<TraceabilitySuggestFixResponse["targetSection"], string> = {
  s1: "§1 Contexto",
  s4: "§4 Contratos API",
  s5: "§5 Lógica",
};

type PreviewState = {
  gapIndex: number;
  result: TraceabilitySuggestFixResponse;
};

export interface TraceabilityGapListProps {
  gaps: CrossDocumentGap[];
  projectId: string;
  stageId?: string | null;
  mddContent?: string;
  maxVisible?: number;
  compact?: boolean;
}

export function TraceabilityGapList({
  gaps,
  projectId,
  stageId,
  mddContent,
  maxVisible = 8,
  compact = false,
}: TraceabilityGapListProps) {
  const suggestTraceabilityFix = useWorkshopStore((s) => s.suggestTraceabilityFix);
  const insertTraceabilityPatch = useWorkshopStore((s) => s.insertTraceabilityPatch);
  const deliveryGate = useWorkshopStore((s) => s.deliveryGate);
  const setNotice = useWorkshopStore((s) => s.setNotice);
  const setError = useWorkshopStore((s) => s.setError);

  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [inserting, setInserting] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      suggestAbortRef.current?.abort();
    };
  }, []);

  const deliveryGateBlockers =
    deliveryGate && !deliveryGate.ok
      ? deliveryGate.blockers.filter((b) => b.trim().length > 0)
      : [];
  const insertBlocked = deliveryGateBlockers.length > 0;

  const handleSuggest = useCallback(
    async (gap: CrossDocumentGap, index: number) => {
      suggestAbortRef.current?.abort();
      const controller = new AbortController();
      suggestAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);

      setLoadingIndex(index);
      setPreview(null);
      setError(null);
      try {
        const result = await suggestTraceabilityFix(projectId, gap, {
          stageId,
          mddContent,
          signal: controller.signal,
        });
        if (result) {
          setPreview({ gapIndex: index, result });
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (suggestAbortRef.current === controller) {
          suggestAbortRef.current = null;
        }
        setLoadingIndex(null);
      }
    },
    [suggestTraceabilityFix, projectId, stageId, mddContent, setError],
  );

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Parche copiado al portapapeles");
    } catch {
      setError("No se pudo copiar al portapapeles");
    }
  }, [setNotice, setError]);

  const handleInsert = useCallback(async () => {
    if (!preview) return;
    if (insertBlocked) {
      const shown = deliveryGateBlockers.slice(0, 2).join(" · ");
      const suffix =
        deliveryGateBlockers.length > 2 ? ` (+${deliveryGateBlockers.length - 2} más)` : "";
      setError(`No se puede guardar: ${shown}${suffix}. Arregla el MDD antes de insertar.`);
      return;
    }
    setInserting(true);
    setError(null);
    try {
      const ok = await insertTraceabilityPatch(preview.result.suggestion, preview.result.targetSection);
      if (ok) {
        setNotice(`Parche insertado en ${TARGET_SECTION_LABEL[preview.result.targetSection]}`);
        setPreview(null);
      }
    } finally {
      setInserting(false);
    }
  }, [
    preview,
    insertTraceabilityPatch,
    setNotice,
    setError,
    insertBlocked,
    deliveryGateBlockers,
  ]);

  const visible = gaps.slice(0, maxVisible);

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {visible.map((gap, i) => {
        const isLoading = loadingIndex === i;
        const isPreview = preview?.gapIndex === i;
        return (
          <div
            key={`${gap.kind ?? "gap"}-${gap.concept.slice(0, 40)}-${i}`}
            className="rounded-md border border-[color-mix(in_oklch,var(--warning)_28%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_8%,var(--card))] p-2"
          >
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-[var(--primary)]" aria-hidden>
                ⚠
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-snug text-[color-mix(in_oklch,var(--muted-foreground)_98%,var(--foreground))]">
                  {gap.hint ? (
                    gap.hint
                  ) : (
                    <>
                      <strong className="text-[color-mix(in_oklch,var(--foreground)_90%,var(--muted-foreground))]">
                        {gap.concept}
                      </strong>{" "}
                      <span className="text-[10px] opacity-90">
                        {gap.from}→{gap.to}
                      </span>{" "}
                      <span
                        className={
                          gap.severity === "missing"
                            ? "text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]"
                            : "text-[var(--primary)]"
                        }
                      >
                        ({gap.severity === "missing" ? "falta" : "parcial"})
                      </span>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  disabled={isLoading || loadingIndex != null}
                  onClick={() => void handleSuggest(gap, i)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="h-3 w-3" aria-hidden />
                  )}
                  {isLoading ? "Generando…" : "Añadir"}
                </button>
              </div>
            </div>

            {isPreview && preview ? (
              <div className="mt-2 space-y-2 border-t border-[var(--border)]/60 pt-2">
                <p className="text-[10px] text-[var(--foreground-subtle)]">
                  Destino: {TARGET_SECTION_LABEL[preview.result.targetSection]}
                  {preview.result.rationale ? ` — ${preview.result.rationale}` : ""}
                </p>
                <pre className="max-h-32 overflow-auto rounded border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-[var(--muted-foreground)]">
                  {preview.result.suggestion}
                </pre>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopy(preview.result.suggestion)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--muted)]"
                  >
                    <Copy className="h-3 w-3" aria-hidden />
                    Copiar
                  </button>
                  {insertBlocked ? (
                    <p className="flex w-full items-start gap-1 rounded-md border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_10%,var(--card))] px-2 py-1.5 text-[10px] leading-snug text-[color-mix(in_oklch,var(--warning)_90%,var(--foreground))]">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span>
                        No se puede guardar: {deliveryGateBlockers.slice(0, 2).join(" · ")}
                        {deliveryGateBlockers.length > 2
                          ? ` (+${deliveryGateBlockers.length - 2} más)`
                          : ""}
                        . Arregla el MDD antes de insertar.
                      </span>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={inserting || insertBlocked}
                    onClick={() => void handleInsert()}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)] px-2 py-1 text-[10px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {inserting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                    Insertar en MDD
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-3 w-3" aria-hidden />
                    Descartar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      {gaps.length > maxVisible ? (
        <p className="text-[10px] text-[var(--foreground-subtle)]">+{gaps.length - maxVisible} más</p>
      ) : null}
    </div>
  );
}
