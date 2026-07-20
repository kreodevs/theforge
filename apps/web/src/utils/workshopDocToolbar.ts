import { FileText, Palette, Pencil, type LucideIcon } from "lucide-react";

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
