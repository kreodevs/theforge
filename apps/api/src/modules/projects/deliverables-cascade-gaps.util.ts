import type { Project } from "@theforge/database";
import type { DeliverableWaveStep } from "@theforge/shared-types";
import {
  checkApiVsMdd,
  checkBlueprintDataModelVsMdd,
  checkBlueprintSectionHeaders,
  checkBlueprintSelfContained,
  checkInfraVsMdd,
  checkLogicFlowsVsMdd,
} from "../engine/conformance.service.js";

/** Gaps de conformidad heurística por paso de oleada (feedback inline en cascada). */
export function buildExistingConformanceGapsMap(
  projectFresh: Project,
  mddContent: string,
  steps: DeliverableWaveStep[],
): Map<string, string> {
  const gapsMap = new Map<string, string>();
  for (const step of steps) {
    if (step === "ui_screens_sync") continue;
    const stepKey = step as string;
    if (stepKey === "blueprint") {
      const bp = projectFresh?.blueprintContent ?? "";
      if (bp.trim().length > 80) {
        const entityCheck = checkBlueprintDataModelVsMdd(mddContent, bp);
        const sectionCheck = checkBlueprintSectionHeaders(bp);
        const selfCheck = checkBlueprintSelfContained(bp);
        const allGaps = entityCheck.gaps.concat(sectionCheck.gaps, selfCheck.gaps);
        if (allGaps.length > 0) gapsMap.set("blueprint", allGaps.join("\n"));
      }
    } else if (stepKey === "api_contracts") {
      const api = projectFresh?.apiContractsContent ?? "";
      if (api.trim().length > 80) {
        const apiCheck = checkApiVsMdd(mddContent, api);
        const apiGaps = [...apiCheck.missingInApi, ...apiCheck.extraInApi];
        if (apiGaps.length > 0) gapsMap.set("api_contracts", apiGaps.join("\n"));
      }
    } else if (stepKey === "logic_flows") {
      const lf = projectFresh?.logicFlowsContent ?? "";
      if (lf.trim().length > 80) {
        const lfCheck = checkLogicFlowsVsMdd(mddContent, lf);
        if (lfCheck.gaps.length > 0) gapsMap.set("logic_flows", lfCheck.gaps.join("\n"));
      }
    } else if (stepKey === "infra") {
      const infra = projectFresh?.infraContent ?? "";
      if (infra.trim().length > 80) {
        const infraCheck = checkInfraVsMdd(mddContent, infra);
        if (infraCheck.gaps.length > 0) gapsMap.set("infra", infraCheck.gaps.join("\n"));
      }
    }
  }
  return gapsMap;
}
