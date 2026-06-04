import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveRegenerationStepLabel,
  resolveRegenerationTotalSteps,
} from "@/utils/regenerationStepLabels";
import { formatDurationMs } from "@/utils/formatDuration";
import type { ComponentSourceRegenerationStep } from "@/types/component-source-profiles";

interface RegenerationProgressBannerProps {
  title?: string;
  progress: ComponentSourceRegenerationStep | null;
  stepsHistory: ComponentSourceRegenerationStep[];
  error?: string | null;
  onDismiss?: () => void;
  className?: string;
}

function stepState(
  stepNum: number,
  current: ComponentSourceRegenerationStep | null,
  history: ComponentSourceRegenerationStep[],
): "done" | "running" | "pending" | "error" {
  const historyEntry = history.find((s) => s.step === stepNum);
  if (historyEntry?.status === "error") return "error";
  if (historyEntry?.status === "done") return "done";
  if (current?.step === stepNum && current.status === "running") return "running";
  if (current?.step === stepNum && current.status === "done") return "done";
  if (current?.status === "running" && history.some((s) => s.step > stepNum && s.status === "done")) {
    return "done";
  }
  return "pending";
}

/**
 * Reusable step banner for MCP profile change regeneration (Settings + Workshop).
 * Labels come from SSE (`progress` / `stepsHistory`); fallbacks align with WireframesPanel.
 */
export function RegenerationProgressBanner({
  title = "Regeneración por cambio de MCP",
  progress,
  stepsHistory,
  error,
  onDismiss,
  className,
}: RegenerationProgressBannerProps) {
  const totalSteps = resolveRegenerationTotalSteps(progress, stepsHistory);
  const currentStep = progress?.step ?? 0;
  const visible = Boolean(progress) || stepsHistory.length > 0 || Boolean(error);

  if (!visible) return null;

  const stepEntries = Array.from({ length: totalSteps }, (_, i) => {
    const num = i + 1;
    const historyEntry = stepsHistory.find((s) => s.step === num);
    const state = stepState(num, progress, stepsHistory);
    const label = resolveRegenerationStepLabel(num, progress, stepsHistory);
    return {
      num,
      label,
      state,
      detail: historyEntry?.status === "done" ? historyEntry.detail : undefined,
      durationMs: historyEntry?.status === "done" ? historyEntry.durationMs : undefined,
    };
  });

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.08)] sm:p-5",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
          {currentStep > 0 ? (
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Paso {currentStep} de {totalSteps}
            </p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onDismiss}
            aria-label="Cerrar aviso de regeneración"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      <div className="space-y-0">
        {stepEntries.map((entry, idx) => (
          <div key={entry.num} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  entry.state === "done" &&
                    "bg-[color-mix(in_oklch,var(--primary)_18%,var(--card))] text-[var(--primary)]",
                  entry.state === "running" &&
                    "bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] text-[var(--primary)] ring-2 ring-[color-mix(in_oklch,var(--primary)_35%,transparent)]",
                  entry.state === "pending" &&
                    "bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] text-[var(--muted-foreground)]",
                  entry.state === "error" &&
                    "bg-[color-mix(in_oklch,var(--destructive)_15%,var(--card))] text-[var(--destructive)]",
                )}
              >
                {entry.state === "done" && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {entry.state === "running" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                )}
                {entry.state === "pending" && <Circle className="h-3 w-3" strokeWidth={2} />}
                {entry.state === "error" && <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </div>
              {idx < stepEntries.length - 1 && (
                <div
                  className={cn(
                    "my-0.5 min-h-[16px] w-px flex-1",
                    entry.state === "done"
                      ? "bg-[color-mix(in_oklch,var(--primary)_30%,var(--border))]"
                      : "bg-[var(--border)]",
                  )}
                />
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2 pb-3">
              <span
                className={cn(
                  "text-sm transition-colors duration-200",
                  entry.state === "done" && "font-medium text-[var(--foreground)]",
                  entry.state === "running" && "font-semibold text-[var(--foreground)]",
                  entry.state === "pending" && "text-[var(--muted-foreground)]",
                  entry.state === "error" && "font-medium text-[var(--destructive)]",
                )}
              >
                {entry.label}
                {entry.detail && (entry.state === "done" || entry.state === "error") ? (
                  <span
                    className={cn(
                      "ml-1.5 text-xs font-normal",
                      entry.state === "error"
                        ? "text-[var(--destructive)]"
                        : "text-[var(--muted-foreground)]",
                    )}
                  >
                    — {entry.detail}
                  </span>
                ) : null}
              </span>
              {entry.state === "done" && entry.durationMs != null ? (
                <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
                  {formatDurationMs(entry.durationMs)}
                </span>
              ) : null}
              {entry.state === "running" ? (
                <span className="shrink-0 text-xs text-[var(--muted-foreground)]">…</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
