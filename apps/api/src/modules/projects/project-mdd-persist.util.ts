import { ComplexityLevel, type Project } from "@theforge/database";
import type { SemaphoreEvaluationInput } from "../engine/semaphore.service.js";
import type { UpdateProjectDto } from "@theforge/shared-types";
import { mddHasSubstantialBody } from "@theforge/shared-types/mdd-governance-patterns";

export type SemaphoreProjectFields = Pick<
  Project,
  | "complexity"
  | "hasUxTeam"
  | "figmaMapping"
  | "specContent"
  | "useCasesContent"
  | "userStoriesContent"
  | "tasksContent"
  | "apiContractsContent"
  | "uxUiGuideContent"
  | "logicFlowsContent"
  | "infraContent"
>;

/** Base de semáforo sin MDD — compartida entre PATCH, jobs MDD y parches desde gaps. */
export function buildSemaphoreBaseFromProject(
  p: SemaphoreProjectFields,
): Omit<SemaphoreEvaluationInput, "mddJsonString"> {
  return {
    complexity: p.complexity ?? ComplexityLevel.HIGH,
    hasUxTeam: p.hasUxTeam,
    figmaMapping: p.figmaMapping,
    deliverables: {
      specContent: p.specContent,
      useCasesContent: p.useCasesContent,
      userStoriesContent: p.userStoriesContent,
      tasksContent: p.tasksContent,
      apiContractsContent: p.apiContractsContent,
      uxUiGuideContent: p.uxUiGuideContent,
      logicFlowsContent: p.logicFlowsContent,
      infraContent: p.infraContent,
    },
  };
}

/** Mezcla campos de entregables del PATCH sobre el proyecto existente para evaluar semáforo. */
export function mergeProjectFieldsForSemaphore(
  existing: Project,
  rest: Partial<UpdateProjectDto>,
): SemaphoreProjectFields {
  return {
    complexity: (rest.complexity ?? existing.complexity) as ComplexityLevel,
    hasUxTeam: rest.hasUxTeam ?? existing.hasUxTeam,
    figmaMapping: (rest.figmaMapping !== undefined ? rest.figmaMapping : existing.figmaMapping) as Project["figmaMapping"],
    specContent: rest.specContent !== undefined ? rest.specContent : existing.specContent,
    useCasesContent: rest.useCasesContent !== undefined ? rest.useCasesContent : existing.useCasesContent,
    userStoriesContent: rest.userStoriesContent !== undefined ? rest.userStoriesContent : existing.userStoriesContent,
    tasksContent: rest.tasksContent !== undefined ? rest.tasksContent : existing.tasksContent,
    apiContractsContent: rest.apiContractsContent !== undefined ? rest.apiContractsContent : existing.apiContractsContent,
    uxUiGuideContent: rest.uxUiGuideContent !== undefined ? rest.uxUiGuideContent : existing.uxUiGuideContent,
    logicFlowsContent: rest.logicFlowsContent !== undefined ? rest.logicFlowsContent : existing.logicFlowsContent,
    infraContent: rest.infraContent !== undefined ? rest.infraContent : existing.infraContent,
  };
}

export type MddPatchPersistFlags = {
  clearMddCompletely?: boolean;
  mddGovernanceSeedOnly?: boolean;
  allowGovernancePatternChange?: boolean;
  mddFormatOnly?: boolean;
};

/** Modo de persistencia MDD en PATCH según flags del wizard/seed/format. */
export function resolveMddPersistMode(
  mddMarkdown: string,
  flags: MddPatchPersistFlags,
): "format" | "store" | "pipeline" {
  if (flags.mddFormatOnly === true) return "format";
  const skipPipelineForSeed =
    flags.clearMddCompletely === true ||
    (flags.mddGovernanceSeedOnly === true && !mddHasSubstantialBody(mddMarkdown));
  const skipPipelineForPatternWizard =
    flags.allowGovernancePatternChange === true &&
    flags.clearMddCompletely !== true &&
    flags.mddGovernanceSeedOnly !== true &&
    flags.mddFormatOnly !== true;
  if (skipPipelineForSeed || skipPipelineForPatternWizard) return "store";
  return "pipeline";
}
