import { Injectable } from "@nestjs/common";
import {
  ConformanceService,
  type ApiConformanceResult,
  type ConformanceResult,
} from "../engine/conformance.service.js";
import { AiService } from "../ai/ai.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import { buildConstitutionMarkdown } from "./constitution-markdown.util.js";
import {
  buildConformanceSummary,
  collectConformanceGaps,
} from "./conformance-gaps.util.js";
import { pickPrimaryStage } from "./stage-helpers.js";

@Injectable()
export class ProjectConformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conformance: ConformanceService,
    private readonly ai: AiService,
  ) {}

  /** Auditoría integral: conformidad heurística + métricas en vivo + gaps SDD. */
  async auditDocuments(projectId: string, options?: { useLlm?: boolean }) {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
    const mdd = buildConstitutionMarkdown(project);
    const conformance = await this.getConformance(projectId, options);
    const conformanceSummary = buildConformanceSummary(this.conformance, mdd, project);
    const crossArtifactGaps = collectConformanceGaps(this.conformance, mdd, project);
    const stage = pickPrimaryStage(project.stages ?? []);
    return {
      projectId,
      projectName: project.name,
      stageStatus: stage?.status ?? null,
      precisionScore: stage?.precisionScore ?? null,
      conformance,
      conformanceSummary,
      crossArtifactGaps: crossArtifactGaps.slice(0, 24),
      auditedAt: new Date().toISOString(),
    };
  }

  async getConformance(
    projectId: string,
    options?: { useLlm?: boolean },
  ): Promise<{
    blueprint: ConformanceResult;
    blueprintDataModel: ConformanceResult;
    api: ApiConformanceResult;
    logicFlows: ConformanceResult;
    infra: ConformanceResult;
  }> {
    const p = await loadAccessibleProjectWithStages(this.prisma, projectId);
    const mdd = buildConstitutionMarkdown(p);

    const blueprintDataModel = this.conformance.checkBlueprintDataModel(mdd, p.blueprintContent);
    const heuristic = {
      blueprint: this.conformance.checkBlueprint(mdd, p.blueprintContent),
      blueprintDataModel,
      api: this.conformance.checkApi(mdd, p.apiContractsContent),
      logicFlows: this.conformance.checkLogicFlows(mdd, p.logicFlowsContent),
      infra: this.conformance.checkInfra(mdd, p.infraContent),
    };

    if (!options?.useLlm) return heuristic;

    const mddTrim = mdd.trim();
    if (mddTrim.length < 200) return heuristic;

    const [blueprintLlm, apiLlm, logicFlowsLlm, infraLlm] = await Promise.all([
      this.ai.conformanceCheck(mddTrim, (p.blueprintContent ?? "").trim(), "blueprint"),
      this.ai.conformanceCheck(mddTrim, (p.apiContractsContent ?? "").trim(), "api"),
      this.ai.conformanceCheck(mddTrim, (p.logicFlowsContent ?? "").trim(), "logicFlows"),
      this.ai.conformanceCheck(mddTrim, (p.infraContent ?? "").trim(), "infra"),
    ]);

    return {
      blueprint: blueprintLlm.ok ? { ok: true, gaps: [] } : { ok: false, gaps: blueprintLlm.gaps },
      blueprintDataModel,
      api: apiLlm.ok
        ? { ok: true, missingInApi: [], extraInApi: [] }
        : { ok: false, missingInApi: apiLlm.gaps, extraInApi: [] },
      logicFlows: logicFlowsLlm.ok ? { ok: true, gaps: [] } : { ok: false, gaps: logicFlowsLlm.gaps },
      infra: infraLlm.ok ? { ok: true, gaps: [] } : { ok: false, gaps: infraLlm.gaps },
    };
  }

  async verifyDeliverable(
    projectId: string,
    deliverable: "blueprint" | "api" | "infra" | "logicFlows",
  ): Promise<string> {
    const p = await loadAccessibleProjectWithStages(this.prisma, projectId);
    const doc =
      deliverable === "blueprint"
        ? p.blueprintContent
        : deliverable === "api"
          ? p.apiContractsContent
          : deliverable === "logicFlows"
            ? p.logicFlowsContent
            : p.infraContent;
    return this.ai.verifyDeliverable(buildConstitutionMarkdown(p), doc ?? "", deliverable);
  }
}
