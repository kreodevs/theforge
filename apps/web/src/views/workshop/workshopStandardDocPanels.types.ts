import type { ClarifyableDocumentField } from "@theforge/shared-types";
import type { DocumentClarificationSectionProps } from "@/components/DocumentClarificationSection";
import type { WorkshopDocumentTimestamps } from "@/utils/workshop-document-content.util";

export type BuildWorkshopDocClarification = (
  field: ClarifyableDocumentField,
  onApplied: (content: string) => void,
  hint?: string,
  extra?: { clarifyOpen?: boolean; onClarifyOpenChange?: (open: boolean) => void },
) => Omit<DocumentClarificationSectionProps, "content"> | undefined;

export type WorkshopStandardDocPanelId =
  | "architecture"
  | "use-cases"
  | "user-stories"
  | "blueprint"
  | "tasks"
  | "api-contracts"
  | "logic-flows"
  | "infra";

export interface WorkshopDeliverablePanelSlice {
  content: string | null;
  onContentChange: (value: string | null) => void;
  onSave: () => void;
  isDirty: boolean;
  viewMode: "preview" | "source";
  onGenerate: () => void;
  onBlur: () => void;
  timestampField: string;
  clarifyField: ClarifyableDocumentField;
}

export interface WorkshopStandardDocPanelsProps {
  centralPanel: WorkshopStandardDocPanelId | string;
  effectiveMddTrimmed: string;
  loading: boolean;
  loadingReason: string | null;
  mddReviewing: boolean;
  canGenerateFromCodebase: boolean;
  activeStageId: string | null;
  deliverablesReadOnly: boolean;
  tasksPrerequisites: { ready: boolean; hint: string };
  apiBlueprintDmBlocked: boolean;
  apiBlueprintBlockedHint: string | undefined;
  docTs: (field: string) => WorkshopDocumentTimestamps | null;
  buildDocClarification: BuildWorkshopDocClarification;
  architecture: WorkshopDeliverablePanelSlice;
  useCases: WorkshopDeliverablePanelSlice;
  userStories: WorkshopDeliverablePanelSlice;
  blueprint: WorkshopDeliverablePanelSlice;
  tasks: WorkshopDeliverablePanelSlice;
  apiContracts: WorkshopDeliverablePanelSlice;
  logicFlows: WorkshopDeliverablePanelSlice;
  infra: WorkshopDeliverablePanelSlice;
  onLegacyGenerate: (
    deliverable: "blueprint" | "tasks" | "api-contracts" | "infra",
  ) => void;
}
