import type { GenerateResponseOptions } from "./interfaces/llm-provider.interface.js";
import { buildUxGuideDesignRefOptions } from "../design-ref/build-ux-guide-design-ref-options.util.js";

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
  uxGuideDesignRef?: string | null;
};

function sliceDoc(s: string | null | undefined, max: number): string | undefined {
  const t = (s ?? "").trim();
  if (!t) return undefined;
  return t.length <= max ? t : `${t.slice(0, max)}\n…`;
}

/** MDD efectivo para auto-match de design reference. */
export function mddContextForUxGuide(
  project: {
    mddContent?: string | null;
    stages?: { id: string; mddContent: string | null }[];
  },
  stageId?: string,
  clientMdd?: string | null,
): string {
  const fromClient = clientMdd?.trim();
  if (fromClient) return fromClient;
  if (stageId && project.stages?.length) {
    const st = project.stages.find((s) => s.id === stageId);
    if (st?.mddContent?.trim()) return st.mddContent.trim();
  }
  return (project.mddContent ?? "").trim();
}

/**
 * Opciones de LLM para la Guía UX/UI: tipo de proyecto (Stitch solo NEW), fragmentos SDD y design reference.
 */
export function uxGuideLlmOptions(
  project: UxGuideProjectFields,
  mddContext?: string,
): Pick<
  GenerateResponseOptions,
  | "projectTypeForUxGuide"
  | "uxGuideAdditionalDocs"
  | "uxGuideDesignRef"
  | "uxGuideDesignRefPromptBlock"
  | "uxGuideDesignRefEffectiveSlug"
  | "uxGuideDesignRefMode"
> {
  const base: Pick<
    GenerateResponseOptions,
    | "projectTypeForUxGuide"
    | "uxGuideAdditionalDocs"
    | "uxGuideDesignRef"
    | "uxGuideDesignRefPromptBlock"
    | "uxGuideDesignRefEffectiveSlug"
    | "uxGuideDesignRefMode"
  > = {
    projectTypeForUxGuide: project.projectType === "LEGACY" ? "LEGACY" : "NEW",
  };

  const mdd = (mddContext ?? "").trim();
  Object.assign(base, buildUxGuideDesignRefOptions(project, mdd));

  if (project.projectType !== "LEGACY") {
    base.uxGuideAdditionalDocs = {
      spec: sliceDoc(project.specContent, 6000),
      useCases: sliceDoc(project.useCasesContent, 5000),
      userStories: sliceDoc(project.userStoriesContent, 5000),
      logicFlows: sliceDoc(project.logicFlowsContent, 5000),
      architecture: sliceDoc(project.architectureContent, 5000),
      apiContracts: sliceDoc(project.apiContractsContent, 4000),
      dbga: sliceDoc(project.dbgaContent, 4000),
      phase0: sliceDoc(project.phase0SummaryContent, 3000),
    };
  }

  return base;
}
