import type { ArtifactTypeDefinition } from "@theforge/shared-types";

export interface WorkshopAdrItem {
  title?: string;
  status?: string;
  context?: string;
  consequence?: string;
  [key: string]: unknown;
}

export interface WorkshopAdrsPluginPanelsProps {
  centralPanel: string;
  projectId: string;
  activeStageId: string | null;
  adrs: WorkshopAdrItem[];
  pluginArtifactTypes: ArtifactTypeDefinition[];
  onRefreshAdrs: (projectId: string) => void | Promise<void>;
}
