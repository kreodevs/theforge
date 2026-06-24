import { ConformanceService } from "../engine/conformance.service.js";

export interface ProjectDeliverableSource {
  blueprintContent?: string | null;
  apiContractsContent?: string | null;
  logicFlowsContent?: string | null;
  infraContent?: string | null;
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
  return gaps;
}
