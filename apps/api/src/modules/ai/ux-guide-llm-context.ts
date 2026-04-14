import type { GenerateResponseOptions } from "./interfaces/llm-provider.interface.js";

/** Campos de proyecto necesarios para enriquecer la Guía UX/UI y el Prompt Stitch (solo NEW). */
export type UxGuideProjectFields = {
  projectType: string;
  specContent?: string | null;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
  logicFlowsContent?: string | null;
  architectureContent?: string | null;
  apiContractsContent?: string | null;
  dbgaContent?: string | null;
  phase0SummaryContent?: string | null;
};

function sliceDoc(s: string | null | undefined, max: number): string | undefined {
  const t = (s ?? "").trim();
  if (!t) return undefined;
  return t.length <= max ? t : `${t.slice(0, max)}\n…`;
}

/**
 * Opciones de LLM para la Guía UX/UI: tipo de proyecto (Stitch solo NEW) y fragmentos SDD.
 */
export function uxGuideLlmOptions(project: UxGuideProjectFields): Pick<
  GenerateResponseOptions,
  "projectTypeForUxGuide" | "uxGuideAdditionalDocs"
> {
  if (project.projectType === "LEGACY") {
    return { projectTypeForUxGuide: "LEGACY" };
  }
  return {
    projectTypeForUxGuide: "NEW",
    uxGuideAdditionalDocs: {
      spec: sliceDoc(project.specContent, 6000),
      useCases: sliceDoc(project.useCasesContent, 5000),
      userStories: sliceDoc(project.userStoriesContent, 5000),
      logicFlows: sliceDoc(project.logicFlowsContent, 5000),
      architecture: sliceDoc(project.architectureContent, 5000),
      apiContracts: sliceDoc(project.apiContractsContent, 4000),
      dbga: sliceDoc(project.dbgaContent, 4000),
      phase0: sliceDoc(project.phase0SummaryContent, 3000),
    },
  };
}
