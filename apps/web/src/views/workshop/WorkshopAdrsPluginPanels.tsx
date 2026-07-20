import { AdrsPanel } from "@/components/AdrsPanel";
import { PluginDocPanel } from "@/components/PluginDocPanel";
import { isPluginPanel } from "@/utils/workshopDocNav";
import type { WorkshopAdrsPluginPanelsProps } from "./workshopAdrsPluginPanels.types";

export function WorkshopAdrsPluginPanels({
  centralPanel,
  projectId,
  activeStageId,
  adrs,
  pluginArtifactTypes,
  onRefreshAdrs,
}: WorkshopAdrsPluginPanelsProps) {
  if (centralPanel === "adrs") {
    return (
      <AdrsPanel adrs={adrs} projectId={projectId} onRefresh={onRefreshAdrs} />
    );
  }

  if (isPluginPanel(centralPanel) && projectId) {
    return (
      <PluginDocPanel
        panel={centralPanel}
        projectId={projectId}
        artifactTypes={pluginArtifactTypes}
        stageId={activeStageId}
      />
    );
  }

  return null;
}
