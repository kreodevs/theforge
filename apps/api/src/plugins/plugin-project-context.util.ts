import { StageStatus } from "@theforge/database";

/** Campos de entregables core usados por hooks y generateArtifact. */
export interface ProjectDeliverablesSource {
  mddContent?: string | null;
  dbgaContent?: string | null;
  specContent?: string | null;
  phase0SummaryContent?: string | null;
  architectureContent?: string | null;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
  blueprintContent?: string | null;
  uxUiGuideContent?: string | null;
  apiContractsContent?: string | null;
  logicFlowsContent?: string | null;
  tasksContent?: string | null;
  infraContent?: string | null;
  agentGovernanceContent?: string | null;
  aemContent?: string | null;
  uiScreensContent?: string | null;
  brdContent?: string | null;
}

/** Etapa primaria (ACTIVE menor ordinal, si no la de menor ordinal). */
export function pickPrimaryStageForHooks<
  T extends { ordinal: number; workflowStatus?: StageStatus | string },
>(stages: T[]): T | undefined {
  if (!stages.length) return undefined;
  const active = stages
    .filter((s) => s.workflowStatus === StageStatus.ACTIVE)
    .sort((a, b) => a.ordinal - b.ordinal);
  if (active.length > 0) return active[0];
  return [...stages].sort((a, b) => a.ordinal - b.ordinal)[0];
}

/**
 * Contexto de hooks a partir del proyecto + overlay de stage (MDD/BRD).
 * Si no hay plugins, el core ignora hookContext — no altera el flujo.
 */
export function buildProjectHookContext(
  project: ProjectDeliverablesSource,
  stageOverlay?: { mddContent?: string | null; brdContent?: string | null },
): Record<string, string | null | undefined> {
  return buildProjectDeliverablesContext({
    ...project,
    mddContent: stageOverlay?.mddContent ?? null,
    brdContent: stageOverlay?.brdContent ?? null,
  });
}

/** Variante cuando solo se tiene project + stages (p. ej. PluginArtifactService). */
export function buildProjectHookContextFromStages(
  project: ProjectDeliverablesSource,
  stages: Array<{
    ordinal: number;
    workflowStatus?: StageStatus | string;
    mddContent?: string | null;
    brdContent?: string | null;
  }>,
): Record<string, string | null | undefined> {
  const stage = pickPrimaryStageForHooks(stages);
  return buildProjectHookContext(project, {
    mddContent: stage?.mddContent ?? null,
    brdContent: stage?.brdContent ?? null,
  });
}

/** Snapshot de entregables core para hooks y `generateArtifact`. */
export function buildProjectDeliverablesContext(
  source: ProjectDeliverablesSource,
): Record<string, string | null | undefined> {
  return {
    mddContent: source.mddContent,
    dbgaContent: source.dbgaContent,
    specContent: source.specContent,
    phase0SummaryContent: source.phase0SummaryContent,
    architectureContent: source.architectureContent,
    useCasesContent: source.useCasesContent,
    userStoriesContent: source.userStoriesContent,
    blueprintContent: source.blueprintContent,
    uxUiGuideContent: source.uxUiGuideContent,
    apiContractsContent: source.apiContractsContent,
    logicFlowsContent: source.logicFlowsContent,
    tasksContent: source.tasksContent,
    infraContent: source.infraContent,
    agentGovernanceContent: source.agentGovernanceContent,
    aemContent: source.aemContent,
    uiScreensContent: source.uiScreensContent,
    brdContent: source.brdContent,
  };
}

/** True si todos los campos requeridos tienen contenido mínimo. */
export function projectMeetsArtifactRequirements(
  deliverables: Record<string, string | null | undefined>,
  requires: string[] | undefined,
  minLen = 1,
): { ok: true } | { ok: false; missing: string[] } {
  if (!requires?.length) return { ok: true };
  const missing = requires.filter((field) => (deliverables[field] ?? "").trim().length < minLen);
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}
