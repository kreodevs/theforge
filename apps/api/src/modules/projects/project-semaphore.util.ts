import type { Project } from "@theforge/database";
import { normalizeMddContent } from "../engine/mdd-markdown-parser.js";
import { collectSddPrecisionGaps } from "../engine/sdd-precision-checks.util.js";

export function mddJsonStringForSemaphore(mddContent: string | null): string | null {
  if (!mddContent?.trim()) return null;
  const normalized = normalizeMddContent(mddContent);
  return JSON.stringify(normalized);
}

export function countSddPrecisionGaps(
  project: Pick<
    Project,
    | "architectureContent"
    | "blueprintContent"
    | "tasksContent"
    | "logicFlowsContent"
    | "userStoriesContent"
    | "useCasesContent"
    | "apiContractsContent"
    | "uiScreensContent"
    | "phase0SummaryContent"
  >,
  mddMarkdown: string | null | undefined,
): number {
  const mdd = (mddMarkdown ?? "").trim();
  if (mdd.length < 120) return 0;
  return collectSddPrecisionGaps({
    mdd,
    architecture: project.architectureContent,
    blueprint: project.blueprintContent,
    tasks: project.tasksContent,
    logicFlows: project.logicFlowsContent,
    userStories: project.userStoriesContent,
    useCases: project.useCasesContent,
    apiContracts: project.apiContractsContent,
    pantallas: project.uiScreensContent,
    phase0Summary: project.phase0SummaryContent,
  }).length;
}
