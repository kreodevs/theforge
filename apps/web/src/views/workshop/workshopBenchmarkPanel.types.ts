import type { DocumentClarificationSectionProps } from "@/components/DocumentClarificationSection";
import type { ClarifyableDocumentField } from "@theforge/shared-types";
import type { WorkshopDocumentTimestamps } from "@/utils/workshop-document-content.util";

export type BuildWorkshopDocClarification = (
  field: ClarifyableDocumentField,
  onApplied: (content: string) => void,
  hint?: string,
  extra?: { clarifyOpen?: boolean; onClarifyOpenChange?: (open: boolean) => void },
) => Omit<DocumentClarificationSectionProps, "content"> | undefined;

export interface WorkshopBenchmarkMergeAudit {
  type: string;
  threadId?: string;
  question?: string;
  n?: number;
  total?: number;
  message?: string;
}

export interface WorkshopBenchmarkPanelProps {
  projectId: string;
  mergeAudit: WorkshopBenchmarkMergeAudit | null | undefined;
  dbgaContent: string | null;
  specContent: string | null;
  fase0Content: string | null;
  phase0IsEmpty: boolean;
  phase0EntryMode: "interview" | "paste";
  benchmarkPhaseTab: "fase0" | "benchmark";
  benchmarkViewMode: "preview" | "source";
  phase0SummaryViewMode: "preview" | "source";
  benchmarkMarkdown: string | null;
  benchmarkNeedsRegenerate: boolean;
  phase0SummaryContent: string | null;
  loading: boolean;
  loadingReason: string | null;
  lastBenchmarkIdea: string;
  docTs: (field: string) => WorkshopDocumentTimestamps | null;
  buildDocClarification: BuildWorkshopDocClarification;
  onBenchmarkPhaseTabChange: (tab: "fase0" | "benchmark") => void;
  onPhase0Complete: () => void | Promise<void>;
  onNavigatePanel: (panel: string) => void;
  onDbgaRestoreOpen: () => void;
  onDbgaContentChange: (value: string) => void;
  onPhase0SummaryContentChange: (value: string | null) => void;
  onBenchmarkBlur: () => void;
  onPhase0SummaryBlur: () => void;
  onSuggestBrdFromDbga: () => void | Promise<void>;
  onClearDbgaContent: (projectId: string) => void | Promise<void>;
  onClearPhase0SummaryContent: (projectId: string) => void | Promise<void>;
  onPhase0DeepResearch: (
    projectId: string,
    options: { userIdea?: string; includeBenchmark: boolean },
  ) => void | Promise<unknown>;
  onFetchProject: (projectId: string) => void | Promise<unknown>;
}
