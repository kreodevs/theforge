import type { LucideIcon } from "lucide-react";
import type { WorkshopComplexityTier } from "@/utils/workshopDocToolbar";
import type { LegacyFlowState } from "@/store/workshopStore";
import type { WorkshopMobileColumn } from "./workshopMetricsColumn.types";

export interface WorkshopMobileFabsViewModes {
  mddViewMode: "preview" | "source";
  mddInicialViewMode: "preview" | "source";
  specViewMode: "preview" | "source";
  architectureViewMode: "preview" | "source";
  useCasesViewMode: "preview" | "source";
  userStoriesViewMode: "preview" | "source";
  uxUiGuideViewMode: "preview" | "source" | "design";
  aemViewMode: "preview" | "source";
  blueprintViewMode: "preview" | "source";
  apiContractsViewMode: "preview" | "source";
  logicFlowsViewMode: "preview" | "source";
  brdDocViewMode: "preview" | "source";
  infraViewMode: "preview" | "source";
  agentGovernanceViewMode: "preview" | "source";
  tasksViewMode: "preview" | "source";
}

export interface WorkshopPhase0EntryModeToolbarToggle {
  Icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
}

export interface WorkshopMobileFabsProps {
  mobileWorkshopColumn: WorkshopMobileColumn;
  centralPanel: string;
  effectiveComplexityForTabs: WorkshopComplexityTier;
  viewModes: WorkshopMobileFabsViewModes;
  blueprintContent: string | null;
  tasksContent: string | null;
  apiContractsContent: string | null;
  architectureContent: string | null;
  useCasesContent: string | null;
  userStoriesContent: string | null;
  logicFlowsContent: string | null;
  infraContent: string | null;
  activeLegacyState: LegacyFlowState | null;
  mddInicialLocalContent: string;
  activeStageId: string | null;
  benchmarkPhaseTab: "fase0" | "benchmark";
  benchmarkViewMode: "preview" | "source";
  phase0SummaryViewMode: "preview" | "source";
  phase0EntryModeToolbarToggle: WorkshopPhase0EntryModeToolbarToggle | null;
  mobileScrollFabScrollable: boolean;
  scrollFabDirection: "down" | "up";
  onScrollFabClick: () => void;
  onToggleDocViewMode: (panel: string) => void;
  onOpenFlowOrderModal: () => void;
  onBenchmarkViewModeChange: (mode: "preview" | "source") => void;
  onPhase0SummaryViewModeChange: (mode: "preview" | "source") => void;
}
