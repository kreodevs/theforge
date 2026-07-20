import type { AgentGovernanceScaffold } from "@theforge/shared-types";

export type WorkshopAgentPanelId =
  | "agent-governance"
  | "agent-pending-changes"
  | "agent-session-log";

export interface WorkshopAgentPanelsProps {
  centralPanel: WorkshopAgentPanelId | string;
  projectId: string;
  activeStageId: string | null;
  effectiveMddTrimmed: string;
  loading: boolean;
  loadingReason: string | null;
  agentGovernanceContent: string | null;
  agentGovernanceViewMode: "preview" | "source";
  agentGovernanceExportScaffold: AgentGovernanceScaffold | null;
  agentGovernanceExportLoading: boolean;
  agentGovernanceGenerating: boolean;
  hasAgentGovernance: boolean;
  documentationGapsRefreshNonce: number;
  onGenerateAgentGovernance: () => void;
  onFetchProject: (projectId: string) => void | Promise<unknown>;
}
