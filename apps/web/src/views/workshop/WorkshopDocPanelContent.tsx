import { WorkshopAdrsPluginPanels } from "./WorkshopAdrsPluginPanels";
import { WorkshopAgentPanels } from "./WorkshopAgentPanels";
import { WorkshopBenchmarkPanel } from "./WorkshopBenchmarkPanel";
import { WorkshopLegacyPanels } from "./WorkshopLegacyPanels";
import { WorkshopMddPanel } from "./WorkshopMddPanel";
import { WorkshopSpecBrdAemPanels } from "./WorkshopSpecBrdAemPanels";
import { WorkshopStandardDocPanels } from "./WorkshopStandardDocPanels";
import { WorkshopUxGuidePanel } from "./WorkshopUxGuidePanel";
import type { WorkshopDocPanelContentProps } from "./workshopDocPanelContent.types";

export function WorkshopDocPanelContent({
  centralPanel,
  legacy,
  benchmark,
  mdd,
  standard,
  ux,
  specBrdAem,
  agent,
  adrsPlugin,
}: WorkshopDocPanelContentProps) {
  return (
    <>
      <WorkshopLegacyPanels {...legacy} />
      {centralPanel === "benchmark" && <WorkshopBenchmarkPanel {...benchmark} />}
      {centralPanel === "mdd" && <WorkshopMddPanel {...mdd} />}
      <WorkshopStandardDocPanels {...standard} />
      {centralPanel === "ux-ui-guide" && <WorkshopUxGuidePanel {...ux} />}
      <WorkshopSpecBrdAemPanels {...specBrdAem} />
      <WorkshopAgentPanels {...agent} />
      <WorkshopAdrsPluginPanels {...adrsPlugin} />
    </>
  );
}
