/**
 * Gate 2 — validates The Forge change plans against Ariadne (validate_change_plan MCP).
 */
import { Injectable, Logger } from "@nestjs/common";
import type { PlanValidationPersisted, PlanValidationReport } from "@theforge/shared-types";
import {
  buildChangePlanFromProject,
  isBrownfieldCapable,
} from "@theforge/shared-types";
import { Prisma } from "@theforge/database";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TheForgeService } from "../theforge/theforge.service.js";
import { pickPrimaryStage } from "./stage-helpers.js";
import type { Project, Stage } from "@theforge/database";

export type PlanValidationResult =
  | { skipped: true; reason: string }
  | { skipped: false; persisted: PlanValidationPersisted; report: PlanValidationReport };

@Injectable()
export class PlanValidationService {
  private readonly logger = new Logger(PlanValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly theforge: TheForgeService,
  ) {}

  /**
   * Builds ChangePlan from stage deliverables and calls Ariadne validate_change_plan.
   */
  async validateProjectChangePlan(
    projectId: string,
    stageId?: string | null,
  ): Promise<PlanValidationResult> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: true },
    });
    if (!project) return { skipped: true, reason: "project_not_found" };

    const theforgeId = (project as Project & { theforgeProjectId?: string | null }).theforgeProjectId;
    if (!isBrownfieldCapable(theforgeId)) {
      return { skipped: true, reason: "no_codebase_link" };
    }
    if (!this.theforge.isConfigured()) {
      return { skipped: true, reason: "ariadne_mcp_not_configured" };
    }

    const stage =
      (stageId ? project.stages?.find((s) => s.id === stageId) : null) ??
      pickPrimaryStage(project.stages ?? []);

    const changePlan = buildChangePlanFromProject({
      theforgeProjectId: theforgeId!,
      tasksContent: project.tasksContent,
      apiContractsContent: project.apiContractsContent,
      legacyChangeState: stage?.legacyChangeState ?? undefined,
    });

    if (!changePlan || changePlan.files.length === 0) {
      return { skipped: true, reason: "empty_change_plan" };
    }

    const report = await this.theforge.validateChangePlan(changePlan);
    if (!report) {
      return { skipped: true, reason: "validation_call_failed" };
    }

    const persisted: PlanValidationPersisted = {
      validatedAt: new Date().toISOString(),
      verdict: report.verdict,
      score: report.score,
      report,
    };

    await this.persistPlanValidation(stage, persisted);

    this.logger.log(
      `[plan-validation] project=${projectId} verdict=${report.verdict} score=${report.score}`,
    );

    return { skipped: false, persisted, report };
  }

  /** Reads last plan validation from stage legacyChangeState.planValidation. */
  getPlanValidationFromStage(stage: Stage | null | undefined): PlanValidationPersisted | null {
    if (!stage?.legacyChangeState || typeof stage.legacyChangeState !== "object") return null;
    const raw = (stage.legacyChangeState as Record<string, unknown>).planValidation;
    if (!raw || typeof raw !== "object") return null;
    return raw as PlanValidationPersisted;
  }

  /** Loads plan validation for project (optional stageId). */
  async getPlanValidationForProject(
    projectId: string,
    stageId?: string | null,
  ): Promise<PlanValidationPersisted | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: true },
    });
    if (!project?.stages?.length) return null;
    const stage =
      (stageId ? project.stages.find((s) => s.id === stageId) : null) ??
      pickPrimaryStage(project.stages);
    return this.getPlanValidationFromStage(stage);
  }

  private async persistPlanValidation(
    stage: Stage | null | undefined,
    validation: PlanValidationPersisted,
  ): Promise<void> {
    if (!stage?.id) return;
    const prev =
      stage.legacyChangeState && typeof stage.legacyChangeState === "object"
        ? (stage.legacyChangeState as Record<string, unknown>)
        : {};
    await this.prisma.stage.update({
      where: { id: stage.id },
      data: {
        legacyChangeState: {
          ...prev,
          planValidation: validation,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
