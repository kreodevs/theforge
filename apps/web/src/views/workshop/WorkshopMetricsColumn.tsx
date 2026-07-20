import { useEffect, useRef, useState, type RefObject } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkshopStore } from "@/store/workshopStore";
import { WorkshopMetricsColumnInner } from "../WorkshopMetricsColumnInner";
import type { WorkshopMetricsColumnProps } from "./workshopMetricsColumn.types";

/** Columna C del Workshop: panel móvil completo + flyout desktop (semáforo y estimación). */
export function WorkshopMetricsColumn({
  projectId,
  mobileWorkshopColumn,
  isLgLayout,
  metricsSectionRef,
  onOpenAuditModal,
}: WorkshopMetricsColumnProps) {
  const fetchConformance = useWorkshopStore((s) => s.fetchConformance);
  const [conformanceUseLlm, setConformanceUseLlm] = useState(false);
  const [lgMetricsFlyoutOpen, setLgMetricsFlyoutOpen] = useState(false);
  const lgMetricsFlyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLgLayout) setLgMetricsFlyoutOpen(false);
  }, [isLgLayout]);

  useEffect(() => {
    if (!lgMetricsFlyoutOpen || !isLgLayout) return;
    function handlePointerDown(event: PointerEvent) {
      const root = lgMetricsFlyoutRef.current;
      if (root && !root.contains(event.target as Node)) setLgMetricsFlyoutOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLgMetricsFlyoutOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [lgMetricsFlyoutOpen, isLgLayout]);

  const handleConformanceUseLlmChange = (checked: boolean) => {
    setConformanceUseLlm(checked);
    void fetchConformance(projectId, { useLlm: checked });
  };

  const metricsInnerProps = {
    projectId,
    conformanceUseLlm,
    onConformanceUseLlmChange: handleConformanceUseLlmChange,
    onOpenAuditModal,
  };

  return (
    <>
      <section
        ref={metricsSectionRef as RefObject<HTMLElement>}
        className={cn(
          "workshop-metrics-column min-h-0 min-w-0 bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] text-xs leading-snug lg:min-h-0",
          "flex flex-col",
          mobileWorkshopColumn === "metrics"
            ? "flex flex-1 min-h-0 overflow-y-auto lg:hidden"
            : "hidden",
          "overflow-y-auto p-2.5 sm:p-3",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <WorkshopMetricsColumnInner {...metricsInnerProps} />
        </div>
      </section>

      {isLgLayout ? (
        <div
          ref={lgMetricsFlyoutRef}
          className="pointer-events-none absolute right-0 top-1/2 z-[35] -translate-y-1/2"
        >
          <div
            className={cn(
              "overflow-hidden min-h-0 min-w-0 shrink-0 self-stretch max-h-[min(calc(100dvh-2.5rem),90dvh)]",
              "transition-[max-width] duration-300 ease-forge-smooth will-change-[max-width]",
              lgMetricsFlyoutOpen ? "pointer-events-auto" : "pointer-events-none",
              lgMetricsFlyoutOpen
                ? "max-w-[calc(2rem+min(40rem,calc(100vw-3rem)))]"
                : "max-w-[2rem]",
            )}
            onMouseLeave={() => setLgMetricsFlyoutOpen(false)}
          >
            <div
              className={cn(
                "flex max-h-[min(calc(100dvh-2.5rem),90dvh)] flex-row items-stretch gap-0",
                lgMetricsFlyoutOpen && "w-max",
                !lgMetricsFlyoutOpen && "pointer-events-none",
              )}
            >
              <div
                className={cn(
                  "flex shrink-0 flex-col justify-center py-2",
                  !lgMetricsFlyoutOpen && "pointer-events-none",
                )}
              >
                <button
                  type="button"
                  onMouseEnter={() => setLgMetricsFlyoutOpen(true)}
                  onFocus={() => setLgMetricsFlyoutOpen(true)}
                  className={cn(
                    "pointer-events-auto group/pull-tab relative z-[2] flex w-[2rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 px-1 py-2",
                    "rounded-l-xl rounded-r-none border border-[var(--border)] border-r-0 bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]",
                    "text-[8px] font-semibold uppercase tracking-[0.14em] text-[color-mix(in_oklch,var(--foreground)_82%,var(--muted-foreground))]",
                    "shadow-none ring-0 dark:shadow-[0_4px_18px_-6px_rgba(0,0,0,0.42)] dark:ring-1 dark:ring-[color-mix(in_oklch,var(--foreground)_8%,transparent)]",
                    "transition-[color,background-color,box-shadow] duration-200 ease-out",
                    "hover:text-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--muted)_42%,var(--card))]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                    lgMetricsFlyoutOpen &&
                      cn(
                        "text-[var(--primary)] bg-[color-mix(in_oklch,var(--muted)_38%,var(--primary))]",
                        "ring-0 dark:ring-1 dark:ring-[color-mix(in_oklch,var(--primary)_18%,transparent)]",
                      ),
                  )}
                  aria-expanded={lgMetricsFlyoutOpen}
                  aria-controls="workshop-metrics-flyout-panel"
                  title="Semáforo y estimación"
                >
                  <Package
                    className="h-3 w-3 shrink-0 text-[color-mix(in_oklch,var(--foreground)_88%,var(--muted-foreground))] transition-colors duration-200 group-hover/pull-tab:text-[var(--primary)]"
                    aria-hidden
                  />
                  <span className="select-none uppercase leading-tight [writing-mode:vertical-rl] rotate-180">
                    Semáforo
                  </span>
                </button>
              </div>
              <div
                id="workshop-metrics-flyout-panel"
                role="dialog"
                aria-label="Semáforo, conformidad y estimación"
                aria-hidden={!lgMetricsFlyoutOpen}
                hidden={!lgMetricsFlyoutOpen}
                className={cn(
                  "pointer-events-auto flex min-h-0 min-w-[17.5rem] w-[min(40rem,calc(100vw-3rem))] shrink-0 flex-col overflow-hidden rounded-xl",
                  "border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))]",
                  "shadow-[var(--shadow-lg)] ring-0 dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.45)] dark:ring-1 dark:ring-[color-mix(in_oklch,var(--foreground)_8%,transparent)]",
                )}
              >
                <div className="flex min-h-0 max-h-full w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain p-3 sm:p-3.5 [scrollbar-gutter:stable]">
                  <WorkshopMetricsColumnInner layout="flyout" {...metricsInnerProps} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
