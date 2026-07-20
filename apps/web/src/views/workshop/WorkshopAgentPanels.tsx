import { Bot } from "lucide-react";
import { AgentGovernancePanel } from "@/components/AgentGovernancePanel";
import { AgentSessionLogPanel } from "@/components/AgentSessionLogPanel";
import { DocEmptyState } from "@/components/DocEmptyState";
import { PendingDocumentationGapsPanel } from "@/components/PendingDocumentationGapsPanel";
import { WorkshopAgentProgressPanel } from "@/components/WorkshopAgentProgressPanel";
import type { WorkshopAgentPanelsProps } from "./workshopAgentPanels.types";

export function WorkshopAgentPanels({
  centralPanel,
  projectId,
  activeStageId,
  effectiveMddTrimmed,
  loading,
  loadingReason,
  agentGovernanceContent,
  agentGovernanceViewMode,
  agentGovernanceExportScaffold,
  agentGovernanceExportLoading,
  agentGovernanceGenerating,
  hasAgentGovernance,
  documentationGapsRefreshNonce,
  onGenerateAgentGovernance,
  onFetchProject,
}: WorkshopAgentPanelsProps) {
  if (centralPanel === "agent-governance") {
    return agentGovernanceGenerating ? (
      <div className="flex min-h-[min(420px,60vh)] flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <WorkshopAgentProgressPanel
          title={
            loadingReason === "agent-governance"
              ? hasAgentGovernance
                ? "Regenerando gobernanza de agentes…"
                : "Generando gobernanza de agentes…"
              : "Generando entregables…"
          }
          loading
          className="w-full max-w-md"
        />
      </div>
    ) : hasAgentGovernance ? (
      <AgentGovernancePanel
        scaffold={agentGovernanceExportScaffold}
        rawContent={agentGovernanceContent}
        viewMode={agentGovernanceViewMode}
        loading={agentGovernanceExportLoading}
      />
    ) : (
      <DocEmptyState
        icon={Bot}
        title="Gobernanza de agentes"
        description="Scaffold AGENTS.md, .cursor/rules, skills y workflows derivados del MDD (7 §)."
        onGenerate={() => onGenerateAgentGovernance()}
        loading={loading}
        hasMdd={!!effectiveMddTrimmed}
        generateButtonLabel="Generar gobernanza de agentes desde MDD"
      />
    );
  }

  if (centralPanel === "agent-pending-changes" && projectId && activeStageId) {
    return (
      <PendingDocumentationGapsPanel
        projectId={projectId}
        stageId={activeStageId}
        variant="workspace"
        className="min-h-0 flex-1 border-0 bg-transparent p-0 shadow-none"
        refreshToken={documentationGapsRefreshNonce}
        onResolved={() => {
          void onFetchProject(projectId);
        }}
      />
    );
  }

  if (centralPanel === "agent-session-log" && projectId && activeStageId) {
    return (
      <AgentSessionLogPanel
        projectId={projectId}
        stageId={activeStageId}
        variant="workspace"
        className="min-h-0 flex-1 border-0 bg-transparent p-0 shadow-none"
      />
    );
  }

  return null;
}
