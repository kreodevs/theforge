import type { WorkshopDocumentTimestamps } from "@/utils/workshop-document-content.util";

export interface WorkshopUxGuidePanelProps {
  projectName: string | undefined;
  uxUiGuideContent: string | null;
  uxUiGuideDirty: boolean;
  uxUiGuideViewMode: "preview" | "source" | "design";
  effectiveMddTrimmed: string;
  blueprintContent: string | null;
  loading: boolean;
  uxGenerating: boolean;
  uxGuideDesignRef: string;
  docTs: (field: string) => WorkshopDocumentTimestamps | null;
  onUxUiGuideContentChange: (value: string | null) => void;
  onPersistUxUiGuideContent: (content: string) => void;
  onGenerateUxGuide: () => void | Promise<void>;
  onDesignRefChange: (ref: string | null) => void | Promise<void>;
  onUxUiGuideBlur: () => void;
}
