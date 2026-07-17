import { ConformanceService } from "../engine/conformance.service.js";
import { collectSddPrecisionGaps } from "../engine/sdd-precision-checks.util.js";
import {
  findApiSemanticAliasWarnings,
  type ConformanceSummary,
} from "../engine/mdd-quality-audit.util.js";
import { checkApiVsMdd, checkInfraVsMdd } from "../engine/conformance.service.js";

export interface ProjectDeliverableSource {
  blueprintContent?: string | null;
  apiContractsContent?: string | null;
  logicFlowsContent?: string | null;
  infraContent?: string | null;
  architectureContent?: string | null;
  tasksContent?: string | null;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
  uiScreensContent?: string | null;
  phase0SummaryContent?: string | null;
  mddContent?: string | null;
}

/** Recolecta gaps de conformidad MDD ↔ entregables (paridad con sdd-integration.service). */
export function collectConformanceGaps(
  conformance: ConformanceService,
  mdd: string,
  project: ProjectDeliverableSource,
): string[] {
  if (!mdd) return ["MDD vacío: no se puede verificar conformidad"];
  const gaps: string[] = [];
  const bp = conformance.checkBlueprint(mdd, project.blueprintContent ?? null);
  if (!bp.ok) gaps.push(...bp.gaps.map((g) => `[Blueprint] ${g}`));
  const api = conformance.checkApi(mdd, project.apiContractsContent ?? null);
  if (!api.ok) {
    gaps.push(...api.missingInApi.map((g) => `[API falta] ${g}`));
    gaps.push(...api.extraInApi.map((g) => `[API extra] ${g}`));
  }
  const lf = conformance.checkLogicFlows(mdd, project.logicFlowsContent ?? null);
  if (!lf.ok) gaps.push(...lf.gaps.map((g) => `[Flujos] ${g}`));
  const inf = conformance.checkInfra(mdd, project.infraContent ?? null);
  if (!inf.ok) gaps.push(...inf.gaps.map((g) => `[Infra] ${g}`));
  gaps.push(
    ...collectSddPrecisionGaps({
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
    }),
  );
  return gaps;
}

/** Resumen estructurado para semáforo, MCP audit_documents y Workshop. */
export function buildConformanceSummary(
  conformance: ConformanceService,
  mdd: string,
  project: ProjectDeliverableSource,
): ConformanceSummary {
  const apiCheck = checkApiVsMdd(mdd, project.apiContractsContent ?? null);
  const infraCheck = checkInfraVsMdd(mdd, project.infraContent ?? null);
  const bp = conformance.checkBlueprint(mdd, project.blueprintContent ?? null);
  const lf = conformance.checkLogicFlows(mdd, project.logicFlowsContent ?? null);
  const aliasWarnings = findApiSemanticAliasWarnings(mdd, project.apiContractsContent ?? "");
  return {
    ok: apiCheck.ok && infraCheck.ok && bp.ok && lf.ok,
    api: {
      ok: apiCheck.ok,
      missingCount: apiCheck.missingInApi.length,
      extraCount: apiCheck.extraInApi.length,
      aliasWarnings,
    },
    infra: {
      ok: infraCheck.ok,
      gapCount: infraCheck.gaps.length,
      gaps: infraCheck.gaps.slice(0, 12),
    },
    blueprint: { ok: bp.ok },
    logicFlows: { ok: lf.ok },
  };
}
