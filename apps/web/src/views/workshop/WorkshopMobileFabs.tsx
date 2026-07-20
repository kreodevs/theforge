import { ArrowDown, ArrowUp, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getWorkshopDocToolbarActiveViewMode,
  workshopDocSourceTogglePresentation,
} from "@/utils/workshopDocToolbar";
import type { WorkshopMobileFabsProps } from "./workshopMobileFabs.types";

const FAB_VISUAL =
  "flex h-11 w-11 min-h-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_70%,transparent)] text-[var(--primary-foreground)] shadow-lg shadow-black/25 transition-transform active:scale-90 hover:scale-105 touch-manipulation";

/** FABs flotantes móviles: scroll, toggle preview/source y orden de flujo. */
export function WorkshopMobileFabs({
  mobileWorkshopColumn,
  centralPanel,
  effectiveComplexityForTabs,
  viewModes,
  blueprintContent,
  tasksContent,
  apiContractsContent,
  architectureContent,
  useCasesContent,
  userStoriesContent,
  logicFlowsContent,
  infraContent,
  activeLegacyState,
  mddInicialLocalContent,
  activeStageId,
  benchmarkPhaseTab,
  benchmarkViewMode,
  phase0SummaryViewMode,
  phase0EntryModeToolbarToggle,
  mobileScrollFabScrollable,
  scrollFabDirection,
  onScrollFabClick,
  onToggleDocViewMode,
  onOpenFlowOrderModal,
  onBenchmarkViewModeChange,
  onPhase0SummaryViewModeChange,
}: WorkshopMobileFabsProps) {
  const activeDocViewMode = getWorkshopDocToolbarActiveViewMode(centralPanel, viewModes);
  const { Icon: DocToggleIcon, tooltip: docToggleTooltip } = workshopDocSourceTogglePresentation(
    centralPanel,
    activeDocViewMode,
  );
  const showBenchmarkToggle = centralPanel === "benchmark";
  const benchmarkToolbarViewMode =
    benchmarkPhaseTab === "fase0" ? benchmarkViewMode : phase0SummaryViewMode;
  const benchmarkTogglePresentation =
    benchmarkPhaseTab === "fase0" && phase0EntryModeToolbarToggle
      ? phase0EntryModeToolbarToggle
      : workshopDocSourceTogglePresentation("mdd", benchmarkToolbarViewMode);
  const BenchmarkFabToggleIcon = benchmarkTogglePresentation.Icon;
  const docPanelsWithToggle = [
    "spec",
    "mdd",
    "ux-ui-guide",
    "aem",
    "blueprint",
    "tasks",
    "api-contracts",
    "logic-flows",
    "architecture",
    "use-cases",
    "user-stories",
    "infra",
    "brd",
    "mdd-inicial",
  ] as const;
  const showDocToggle =
    centralPanel !== "benchmark" &&
    (docPanelsWithToggle as readonly string[]).includes(centralPanel) &&
    (centralPanel === "spec" ||
      centralPanel === "mdd" ||
      centralPanel === "ux-ui-guide" ||
      centralPanel === "aem" ||
      (centralPanel === "blueprint" && blueprintContent) ||
      (centralPanel === "tasks" && tasksContent) ||
      (centralPanel === "api-contracts" && apiContractsContent) ||
      (centralPanel === "architecture" && architectureContent) ||
      (centralPanel === "use-cases" && useCasesContent) ||
      (centralPanel === "user-stories" && userStoriesContent) ||
      (centralPanel === "logic-flows" && logicFlowsContent) ||
      (centralPanel === "infra" && infraContent) ||
      (centralPanel === "mdd-inicial" && (activeLegacyState?.codebaseDoc || mddInicialLocalContent)) ||
      (centralPanel === "brd" && !!activeStageId));
  const showFlowOrder = effectiveComplexityForTabs === "HIGH";

  const mobileScrollFabBottom =
    mobileWorkshopColumn === "chat"
      ? "calc(3.25rem + 6rem + env(safe-area-inset-bottom, 0px))"
      : "calc(3.25rem + 0.5rem + env(safe-area-inset-bottom, 0px))";

  const showDocOrFlowFabStack =
    mobileWorkshopColumn === "workspace" && (showDocToggle || showFlowOrder || showBenchmarkToggle);

  return (
    <>
      {mobileScrollFabScrollable ? (
        <button
          type="button"
          onClick={onScrollFabClick}
          className={cn(FAB_VISUAL, "lg:hidden fixed right-4 z-20")}
          style={{ bottom: mobileScrollFabBottom }}
          title={scrollFabDirection === "down" ? "Ir al final" : "Ir al inicio"}
          aria-label={
            scrollFabDirection === "down" ? "Ir al final del documento" : "Ir al inicio del documento"
          }
        >
          {scrollFabDirection === "down" ? (
            <ArrowDown className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          ) : (
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      ) : null}

      {showDocOrFlowFabStack ? (
        <div className="lg:hidden pointer-events-none fixed right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end gap-3">
          {showFlowOrder ? (
            <button
              type="button"
              className={cn(FAB_VISUAL, "pointer-events-auto")}
              title="Ver orden completo de flujo"
              aria-label="Ver orden completo de flujo"
              onClick={onOpenFlowOrderModal}
            >
              <ListOrdered className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
          ) : null}

          {showDocToggle ? (
            <button
              type="button"
              className={cn(FAB_VISUAL, "pointer-events-auto")}
              title={docToggleTooltip}
              aria-label={docToggleTooltip}
              onClick={() => onToggleDocViewMode(centralPanel)}
            >
              <DocToggleIcon className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
          ) : null}

          {showBenchmarkToggle ? (
            <button
              type="button"
              className={cn(FAB_VISUAL, "pointer-events-auto")}
              title={benchmarkTogglePresentation.tooltip}
              aria-label={benchmarkTogglePresentation.tooltip}
              onClick={() => {
                if (benchmarkPhaseTab === "fase0" && phase0EntryModeToolbarToggle) {
                  phase0EntryModeToolbarToggle.onClick();
                  return;
                }
                if (benchmarkPhaseTab === "fase0") {
                  onBenchmarkViewModeChange(benchmarkViewMode === "preview" ? "source" : "preview");
                } else {
                  onPhase0SummaryViewModeChange(
                    phase0SummaryViewMode === "preview" ? "source" : "preview",
                  );
                }
              }}
            >
              <BenchmarkFabToggleIcon className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
