/**
 * Contexto compuesto para evaluación de semáforo (conformance + gaps + BRD trace).
 */

import type { Project, Stage } from "@theforge/database";
import {
  applyCompositeReadinessGates,
  type CompositeReadinessResult,
  classifyGap,
} from "@theforge/shared-types";
import { ConformanceService } from "../engine/conformance.service.js";
import {
  buildConformanceSummary,
  collectConformanceGaps,
  type ProjectDeliverableSource,
} from "./conformance-gaps.util.js";
import { computeCrossDocumentConsistency } from "../ai-analysis/estimation/consistency.util.js";
import type { PlanningDocumentFields } from "../ai-analysis/estimation/estimation.types.js";
import { countSddPrecisionGaps } from "./project-semaphore.util.js";
import { SemaphoreService, type SemaphoreEvaluationInput } from "../engine/semaphore.service.js";
import type { Status } from "@theforge/database";

export type CompositeSemaphoreEvaluation = {
  status: Status;
  precisionScore: number;
  composite: CompositeReadinessResult;
  crossArtifactGapCount: number;
  humanRequiredGapCount: number;
  conformanceOk: boolean;
  consistencyScore?: number;
};

export function buildProjectDeliverableSource(
  project: Project,
  stage?: Stage | null,
): ProjectDeliverableSource {
  return {
    ...project,
    brdContent: stage?.brdContent ?? null,
    dbgaContent: project.dbgaContent ?? null,
    domainInventory: stage?.domainInventory ?? null,
    mddContent: stage?.mddContent ?? null,
  };
}

export function collectFullCrossArtifactGaps(
  conformance: ConformanceService,
  mdd: string,
  source: ProjectDeliverableSource,
): string[] {
  if (!mdd.trim()) return ["MDD vacío: no se puede verificar conformidad"];
  return collectConformanceGaps(conformance, mdd, source);
}

export function computeConsistencyScoreForProject(
  mdd: string,
  source: ProjectDeliverableSource,
): number | undefined {
  const brd = source.brdContent?.trim();
  if (!brd || brd.length < 200 || !mdd.trim()) return undefined;
  const docs: PlanningDocumentFields = {
    brdContent: source.brdContent ?? undefined,
    mddContent: mdd,
    specContent: source.specContent ?? undefined,
    architectureContent: source.architectureContent ?? undefined,
    blueprintContent: source.blueprintContent ?? undefined,
    useCasesContent: source.useCasesContent ?? undefined,
    userStoriesContent: source.userStoriesContent ?? undefined,
    apiContractsContent: source.apiContractsContent ?? undefined,
    logicFlowsContent: source.logicFlowsContent ?? undefined,
    infraContent: source.infraContent ?? undefined,
    tasksContent: source.tasksContent ?? undefined,
  };
  return computeCrossDocumentConsistency(docs).score;
}

/** Evalúa semáforo base + puertas compuestas de readiness SDD. */
export function evaluateCompositeSemaphore(
  semaphore: SemaphoreService,
  input: SemaphoreEvaluationInput & {
    mddMarkdown?: string;
    project?: Pick<
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
    >;
    conformance?: ConformanceService;
    deliverableSource?: ProjectDeliverableSource;
  },
): CompositeSemaphoreEvaluation {
  const mdd = input.mddMarkdown ?? "";
  const precisionGapCount =
    input.sddCrossArtifactGapCount ??
    (input.project && mdd.trim().length >= 120
      ? countSddPrecisionGaps(input.project, mdd)
      : 0);

  let crossArtifactGapCount = precisionGapCount;
  let conformanceOk = true;
  let consistencyScore: number | undefined;
  let humanRequiredGapCount = 0;

  if (input.conformance && input.deliverableSource && mdd.trim()) {
    const allGaps = collectFullCrossArtifactGaps(
      input.conformance,
      mdd,
      input.deliverableSource,
    );
    crossArtifactGapCount = allGaps.length;
    humanRequiredGapCount = allGaps.filter((g) => classifyGap(g).kind === "human").length;
    const summary = buildConformanceSummary(input.conformance, mdd, input.deliverableSource);
    conformanceOk = summary.ok;
    consistencyScore = computeConsistencyScoreForProject(mdd, input.deliverableSource);
  }

  const base = semaphore.evaluate({
    ...input,
    sddCrossArtifactGapCount: precisionGapCount,
  });

  const composite = applyCompositeReadinessGates({
    baseStatus: base.status as "ROJO" | "AMARILLO" | "VERDE",
    basePrecisionScore: base.precisionScore,
    conformanceOk,
    crossArtifactGapCount,
    consistencyScore,
    humanRequiredGapCount,
  });

  return {
    status: composite.status as Status,
    precisionScore: composite.precisionScore,
    composite,
    crossArtifactGapCount,
    humanRequiredGapCount,
    conformanceOk,
    consistencyScore,
  };
}
