import type { ClarifyableDocumentField } from "@theforge/shared-types";
import type { WorkshopInitialState } from "../initial-state";

export function workshopStorePatchForClarifiedField(
  field: ClarifyableDocumentField,
  content: string,
): Partial<WorkshopInitialState> {
  switch (field) {
    case "mddContent":
      return { mddContent: content };
    case "dbgaContent":
      return { dbgaContent: content };
    case "specContent":
      return { specContent: content };
    case "architectureContent":
      return { architectureContent: content };
    case "useCasesContent":
      return { useCasesContent: content };
    case "userStoriesContent":
      return { userStoriesContent: content };
    case "blueprintContent":
      return { blueprintContent: content };
    case "tasksContent":
      return { tasksContent: content };
    case "apiContractsContent":
      return { apiContractsContent: content };
    case "logicFlowsContent":
      return { logicFlowsContent: content };
    case "infraContent":
      return { infraContent: content };
    case "agentGovernanceContent":
      return { agentGovernanceContent: content };
    case "uxUiGuideContent":
      return { uxUiGuideContent: content };
    case "uiScreensContent":
      return { uiScreensContent: content };
    case "phase0SummaryContent":
      return { phase0SummaryContent: content };
    case "aemContent":
      return { aemContent: content };
    case "brdContent":
      return {};
    default:
      return {};
  }
}
