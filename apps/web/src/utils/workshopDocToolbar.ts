import { FileText, Palette, Pencil, type LucideIcon } from "lucide-react";
import { isWorkshopAgentActivityPanel } from "./workshopDocNav";

export type WorkshopComplexityTier = "LOW" | "MEDIUM" | "HIGH";

export type WorkshopDocToolbarViewModes = {
  mddViewMode: "preview" | "source";
  mddInicialViewMode: "preview" | "source";
  specViewMode: "preview" | "source";
  architectureViewMode: "preview" | "source";
  useCasesViewMode: "preview" | "source";
  userStoriesViewMode: "preview" | "source";
  uxUiGuideViewMode: "design" | "preview" | "source";
  aemViewMode: "preview" | "source";
  blueprintViewMode: "preview" | "source";
  apiContractsViewMode: "preview" | "source";
  logicFlowsViewMode: "preview" | "source";
  brdDocViewMode: "preview" | "source";
  infraViewMode: "preview" | "source";
  agentGovernanceViewMode: "preview" | "source";
  tasksViewMode: "preview" | "source";
};

export function getWorkshopDocToolbarActiveViewMode(
  centralPanel: string,
  modes: WorkshopDocToolbarViewModes,
): string {
  if (centralPanel === "mdd") return modes.mddViewMode;
  if (centralPanel === "mdd-inicial") return modes.mddInicialViewMode;
  if (centralPanel === "spec") return modes.specViewMode;
  if (centralPanel === "architecture") return modes.architectureViewMode;
  if (centralPanel === "use-cases") return modes.useCasesViewMode;
  if (centralPanel === "user-stories") return modes.userStoriesViewMode;
  if (centralPanel === "ux-ui-guide") return modes.uxUiGuideViewMode;
  if (centralPanel === "aem") return modes.aemViewMode;
  if (centralPanel === "blueprint") return modes.blueprintViewMode;
  if (centralPanel === "api-contracts") return modes.apiContractsViewMode;
  if (centralPanel === "logic-flows") return modes.logicFlowsViewMode;
  if (centralPanel === "brd") return modes.brdDocViewMode;
  if (centralPanel === "agent-governance") return modes.agentGovernanceViewMode;
  if (centralPanel === "tasks") return modes.tasksViewMode;
  return modes.infraViewMode;
}

/** Icon + tooltip for preview/source (and UX guide design) toggle on the doc toolbar. */
export function workshopDocSourceTogglePresentation(
  centralPanel: string,
  activeViewMode: string,
): { Icon: LucideIcon; tooltip: string } {
  if (centralPanel === "ux-ui-guide") {
    if (activeViewMode === "preview") return { Icon: Pencil, tooltip: "Ver markdown" };
    if (activeViewMode === "design") return { Icon: Palette, tooltip: "Ver UI Kit y tokens" };
    return { Icon: FileText, tooltip: "Ver documento DESIGN.md" };
  }
  if (activeViewMode === "preview") return { Icon: Pencil, tooltip: "Editar" };
  return { Icon: FileText, tooltip: "Ver previsualización" };
}

export type WorkshopDocEditToolbarToggle = {
  Icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
};

export type WorkshopDocViewToggleContent = {
  blueprintContent?: string | null;
  tasksContent?: string | null;
  hasAgentGovernance: boolean;
  apiContractsContent?: string | null;
  architectureContent?: string | null;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
  logicFlowsContent?: string | null;
  infraContent?: string | null;
  activeLegacyState?: { codebaseDoc?: string | null } | null;
  mddInicialLocalContent?: string | null;
  activeStageId?: string | null;
};

const WORKSHOP_DOC_VIEW_TOGGLE_PANELS = new Set([
  "spec",
  "mdd",
  "ux-ui-guide",
  "aem",
  "blueprint",
  "tasks",
  "agent-governance",
  "api-contracts",
  "logic-flows",
  "architecture",
  "use-cases",
  "user-stories",
  "infra",
  "brd",
  "mdd-inicial",
]);

/** Whether the mobile doc toolbar should show preview/source toggle for the active panel. */
export function canShowWorkshopDocViewToggle(
  centralPanel: string,
  content: WorkshopDocViewToggleContent,
): boolean {
  if (centralPanel === "benchmark") return false;
  if (!WORKSHOP_DOC_VIEW_TOGGLE_PANELS.has(centralPanel)) return false;
  return (
    centralPanel === "spec" ||
    centralPanel === "mdd" ||
    centralPanel === "ux-ui-guide" ||
    centralPanel === "aem" ||
    (centralPanel === "blueprint" && !!content.blueprintContent) ||
    (centralPanel === "tasks" && !!content.tasksContent) ||
    (centralPanel === "agent-governance" && content.hasAgentGovernance) ||
    (centralPanel === "api-contracts" && !!content.apiContractsContent) ||
    (centralPanel === "architecture" && !!content.architectureContent) ||
    (centralPanel === "use-cases" && !!content.useCasesContent) ||
    (centralPanel === "user-stories" && !!content.userStoriesContent) ||
    (centralPanel === "logic-flows" && !!content.logicFlowsContent) ||
    (centralPanel === "infra" && !!content.infraContent) ||
    (centralPanel === "mdd-inicial" &&
      !!(content.activeLegacyState?.codebaseDoc || content.mddInicialLocalContent)) ||
    (centralPanel === "brd" && !!content.activeStageId)
  );
}

export type ResolveWorkshopDocEditToolbarToggleInput = {
  centralPanel: string;
  viewModes: WorkshopDocToolbarViewModes;
  content: WorkshopDocViewToggleContent;
  hasAgentGovernance: boolean;
  benchmarkPhaseTab: "fase0" | "benchmark";
  benchmarkViewMode: "preview" | "source";
  phase0SummaryViewMode: "preview" | "source";
  phase0EntryModeToolbarToggle: WorkshopDocEditToolbarToggle | null;
  toggleDocViewMode: (panel: string) => void;
  setBenchmarkViewMode: (updater: (m: "preview" | "source") => "preview" | "source") => void;
  setPhase0SummaryViewMode: (updater: (m: "preview" | "source") => "preview" | "source") => void;
};

/** Resolves desktop preview/source (or Paso 0 interview/paste) toggle for the doc toolbar. */
export function resolveWorkshopDocEditToolbarToggle(
  input: ResolveWorkshopDocEditToolbarToggleInput,
): WorkshopDocEditToolbarToggle | null {
  const {
    centralPanel,
    viewModes,
    content,
    hasAgentGovernance,
    benchmarkPhaseTab,
    benchmarkViewMode,
    phase0SummaryViewMode,
    phase0EntryModeToolbarToggle,
    toggleDocViewMode,
    setBenchmarkViewMode,
    setPhase0SummaryViewMode,
  } = input;

  if (centralPanel === "legacy" || centralPanel === "adrs" || centralPanel === "integration") return null;
  if (isWorkshopAgentActivityPanel(centralPanel)) return null;

  const showDocEdit =
    WORKSHOP_DOC_VIEW_TOGGLE_PANELS.has(centralPanel) &&
    canShowWorkshopDocViewToggle(centralPanel, { ...content, hasAgentGovernance });
  const showBenchmarkEdit = centralPanel === "benchmark";
  if (!showDocEdit && !showBenchmarkEdit) return null;

  if (showBenchmarkEdit) {
    if (benchmarkPhaseTab === "fase0" && phase0EntryModeToolbarToggle) {
      return phase0EntryModeToolbarToggle;
    }
    const benchmarkViewModeActive =
      benchmarkPhaseTab === "fase0" ? benchmarkViewMode : phase0SummaryViewMode;
    const { Icon, tooltip } = workshopDocSourceTogglePresentation("mdd", benchmarkViewModeActive);
    return {
      Icon,
      tooltip,
      onClick: () => {
        if (benchmarkPhaseTab === "fase0") {
          setBenchmarkViewMode((m) => (m === "preview" ? "source" : "preview"));
        } else {
          setPhase0SummaryViewMode((m) => (m === "preview" ? "source" : "preview"));
        }
      },
    };
  }

  const activeDocViewMode = getWorkshopDocToolbarActiveViewMode(centralPanel, viewModes);
  const { Icon, tooltip } = workshopDocSourceTogglePresentation(centralPanel, activeDocViewMode);
  return {
    Icon,
    tooltip,
    onClick: () => toggleDocViewMode(centralPanel),
  };
}
