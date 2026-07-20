import type { RefObject } from "react";

export type WorkshopMobileColumn = "chat" | "workspace" | "metrics";

export interface WorkshopMetricsColumnProps {
  projectId: string;
  mobileWorkshopColumn: WorkshopMobileColumn;
  isLgLayout: boolean;
  metricsSectionRef: RefObject<HTMLElement | null>;
  onOpenAuditModal: () => void;
}
