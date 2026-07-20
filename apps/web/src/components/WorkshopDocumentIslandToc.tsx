import { lazy, Suspense, type RefObject } from "react";
import {
  getWorkshopDocToolbarActiveViewMode,
  type WorkshopDocToolbarViewModes,
} from "../utils/workshopDocToolbar";

export type { WorkshopDocToolbarViewModes } from "../utils/workshopDocToolbar";

const DynamicIslandTOC = lazy(() =>
  import("@/components/ui/dynamic-island-toc").then((mod) => ({
    default: mod.DynamicIslandTOC,
  })),
);

const MARKDOWN_PREVIEW_SELECTOR =
  ".markdown-preview h1, .markdown-preview h2, .markdown-preview h3, .markdown-preview h4, .markdown-preview [data-toc]";

const NON_MARKDOWN_PANELS = new Set([
  "legacy",
  "adrs",
  "wireframes",
  "agent-pending-changes",
  "agent-session-log",
]);

export function isWorkshopMarkdownPreviewActive(
  centralPanel: string,
  modes: WorkshopDocToolbarViewModes,
  benchmarkPhaseTab: "fase0" | "benchmark",
  benchmarkViewMode: "preview" | "source",
  phase0SummaryViewMode: "preview" | "source",
): boolean {
  if (NON_MARKDOWN_PANELS.has(centralPanel)) return false;

  if (centralPanel === "benchmark") {
    return benchmarkPhaseTab === "fase0"
      ? benchmarkViewMode === "preview"
      : phase0SummaryViewMode === "preview";
  }

  if (centralPanel === "ux-ui-guide") {
    return modes.uxUiGuideViewMode === "preview";
  }

  return getWorkshopDocToolbarActiveViewMode(centralPanel, modes) === "preview";
}

export interface WorkshopDocumentIslandTocProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  centralPanel: string;
  contentKey: string;
}

/**
 * Desktop-only table of contents for long workshop markdown previews.
 */
export function WorkshopDocumentIslandToc({
  scrollContainerRef,
  enabled,
  centralPanel,
  contentKey,
}: WorkshopDocumentIslandTocProps) {
  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <DynamicIslandTOC
        selector={MARKDOWN_PREVIEW_SELECTOR}
        scrollContainerRef={scrollContainerRef}
        contentKey={`${centralPanel}:${contentKey}`}
        minHeadings={2}
      />
    </Suspense>
  );
}
