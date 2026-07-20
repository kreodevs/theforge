import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, type Status } from "@theforge/database";
import type { MddDeliveryGateResult } from "@theforge/shared-types";
import {
  enforceMddGovernancePatternsOnPersist,
  mddHasSubstantialBody,
  selectedPatternIdsFromMdd,
  updateMddGovernancePatterns,
} from "@theforge/shared-types/mdd-governance-patterns";
import { peelDocumentBodyForPersist } from "@theforge/shared-types";
import { ChangeLogService } from "../change-log/change-log.service.js";
import { MddUpdatePipelineService } from "../engine/mdd-update-pipeline.service.js";
import { prepareMddForOutput } from "../ai-analysis/utils/mdd-prepare-output.js";
import { storeMddMarkdownForPersist } from "../ai-analysis/utils/mdd-sanitize.js";
import {
  buildMddDeliveryGateConflictBody,
  buildMddPatchPipelineErrorBody,
  evaluateMddDeliveryGatePrepared,
  MDD_DELIVERY_GATE_ERR,
} from "../ai-analysis/utils/mdd-delivery-gate-guard.util.js";
import { mergeDeliveryGateIntoShortTermContext } from "../ai-analysis/utils/mdd-delivery-gate.util.js";
import { cleanDocumentContent } from "../sessions/document-content.util.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import {
  buildSemaphoreBaseFromProject,
  mergeProjectFieldsForSemaphore,
  resolveMddPersistMode,
  type MddPatchPersistFlags,
  type SemaphoreProjectFields,
} from "./project-mdd-persist.util.js";
import { ProjectEstimationRecalcService } from "./project-estimation-recalc.service.js";
import { pickPrimaryStage, type StageWithEstimation } from "./stage-helpers.js";

export type PersistMddFromPatchInput = {
  projectId: string;
  stageId: string;
  mddMarkdown: string;
  mergedForSemaphore: SemaphoreProjectFields;
  stageBaseline: { status: Status; precisionScore: number };
  documentMeta?: {
    documentAst: unknown | null;
    documentVersion?: number | null;
  };
  patchFlags: MddPatchPersistFlags;
};

export type PersistMddFromPatchResult = {
  sanitizedMdd: string;
  status: Status;
  precisionScore: number;
};

@Injectable()
export class ProjectMddPersistService {
  private readonly logger = new Logger(ProjectMddPersistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly changeLog: ChangeLogService,
    private readonly mddUpdatePipeline: MddUpdatePipelineService,
    private readonly estimationRecalc: ProjectEstimationRecalcService,
  ) {}

  async persistMddDeliveryGateSnapshot(
    stageId: string,
    gate: MddDeliveryGateResult,
  ): Promise<void> {
    try {
      const stage = await this.prisma.stage.findUnique({
        where: { id: stageId },
        select: { shortTermContext: true },
      });
      const prev =
        stage?.shortTermContext &&
        typeof stage.shortTermContext === "object" &&
        !Array.isArray(stage.shortTermContext)
          ? (stage.shortTermContext as Record<string, unknown>)
          : {};
      await this.prisma.stage.update({
        where: { id: stageId },
        data: {
          shortTermContext: mergeDeliveryGateIntoShortTermContext(prev, gate) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(
        `[DeliveryGate] snapshot persist failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** BadRequest 400 con cuerpo estructurado para fallos del pipeline MDD en PATCH. */
  async throwMddPipelineBadRequest(
    result: { code: string; message: string },
    stageId: string,
    mddRaw: string,
  ): Promise<never> {
    if (result.code === MDD_DELIVERY_GATE_ERR) {
      const gate = await evaluateMddDeliveryGatePrepared(mddRaw);
      void this.persistMddDeliveryGateSnapshot(stageId, gate);
      throw new BadRequestException(
        buildMddPatchPipelineErrorBody(
          MDD_DELIVERY_GATE_ERR,
          buildMddDeliveryGateConflictBody(gate).message,
          stageId,
          gate,
        ),
      );
    }
    throw new BadRequestException(
      buildMddPatchPipelineErrorBody(result.code, result.message, stageId),
    );
  }

  /**
   * Persistencia MDD desde job en background (cola theforge-mdd).
   * - Borradores (`finalize: false`): sin delivery gate — el MDD puede estar incompleto.
   * - Final (`finalize: true`): pipeline completo (gate + semáforo + estimación).
   */
  async persistMddFromBackgroundJob(
    projectId: string,
    rawMarkdown: string,
    options?: { stageId?: string; finalize?: boolean; lockedPatternIds?: readonly string[] },
  ): Promise<void> {
    const existing = await loadAccessibleProjectWithStages(this.prisma, projectId);
    const targetStage: StageWithEstimation | undefined =
      (options?.stageId?.trim() && existing.stages.find((s) => s.id === options.stageId!.trim())) ||
      pickPrimaryStage(existing.stages);
    if (!targetStage) throw new BadRequestException("El proyecto no tiene etapas");

    const lockedIds =
      options?.lockedPatternIds?.length
        ? new Set(options.lockedPatternIds)
        : selectedPatternIdsFromMdd(peelDocumentBodyForPersist(targetStage.mddContent ?? ""));
    const applyLockedPatterns = (md: string): string =>
      lockedIds.size > 0 ? updateMddGovernancePatterns(md, lockedIds) : md;

    const cleaned = cleanDocumentContent(peelDocumentBodyForPersist(rawMarkdown));
    if (cleaned.trim().length < 48) return;

    const enforced = enforceMddGovernancePatternsOnPersist(cleaned, targetStage.mddContent, {});
    const mddForPipeline = applyLockedPatterns(enforced.markdown);

    if (!options?.finalize) {
      const prepared = await prepareMddForOutput(mddForPipeline);
      const stored = storeMddMarkdownForPersist(applyLockedPatterns(prepared));
      await this.prisma.stage.update({
        where: { id: targetStage.id },
        data: { mddContent: stored },
      });
      await this.changeLog.log(projectId, "mddContent", prepared);
      return;
    }

    const mergedForSemaphore = mergeProjectFieldsForSemaphore(existing, {});
    const result = await this.mddUpdatePipeline.process(
      mddForPipeline,
      buildSemaphoreBaseFromProject(mergedForSemaphore),
      { projectId, stageId: targetStage.id },
    );
    if (!result.ok) {
      if (result.code === MDD_DELIVERY_GATE_ERR) {
        const gate = await evaluateMddDeliveryGatePrepared(mddForPipeline);
        void this.persistMddDeliveryGateSnapshot(targetStage.id, gate);
      }
      throw new BadRequestException({
        code: result.code,
        message: result.message,
      });
    }

    const finalMdd = applyLockedPatterns(result.sanitizedMdd);
    await this.prisma.stage.update({
      where: { id: targetStage.id },
      data: {
        mddContent: storeMddMarkdownForPersist(finalMdd),
        status: result.status,
        precisionScore: result.precisionScore,
      },
    });
    await this.changeLog.log(projectId, "mddContent", finalMdd);
    void this.persistMddDeliveryGateSnapshot(
      targetStage.id,
      await evaluateMddDeliveryGatePrepared(finalMdd),
    );
    await this.estimationRecalc.recalcAndUpsert(targetStage.id, {
      mddContent: finalMdd,
      infraContent: existing.infraContent ?? null,
      status: result.status,
    });
  }

  /** Persistencia MDD desde `PATCH /projects/:id` (format-only, seed/wizard o pipeline completo). */
  async persistMddFromPatch(input: PersistMddFromPatchInput): Promise<PersistMddFromPatchResult> {
    const {
      projectId,
      stageId,
      mddMarkdown,
      mergedForSemaphore,
      stageBaseline,
      documentMeta,
      patchFlags,
    } = input;
    const mode = resolveMddPersistMode(mddMarkdown, patchFlags);
    const documentData = this.buildStageDocumentUpdate(documentMeta);

    if (mode === "format" || mode === "store") {
      const formatted = storeMddMarkdownForPersist(mddMarkdown);
      await this.prisma.stage.update({
        where: { id: stageId },
        data: { mddContent: formatted, ...documentData },
      });
      await this.changeLog.log(projectId, "mddContent", formatted);
      return {
        sanitizedMdd: formatted,
        status: stageBaseline.status,
        precisionScore: stageBaseline.precisionScore,
      };
    }

    const result = await this.mddUpdatePipeline.process(
      mddMarkdown,
      buildSemaphoreBaseFromProject(mergedForSemaphore),
      { projectId, stageId },
    );
    if (!result.ok) {
      await this.throwMddPipelineBadRequest(result, stageId, mddMarkdown);
    }

    await this.prisma.stage.update({
      where: { id: stageId },
      data: {
        mddContent: storeMddMarkdownForPersist(result.sanitizedMdd),
        status: result.status,
        precisionScore: result.precisionScore,
        ...documentData,
      },
    });
    await this.changeLog.log(projectId, "mddContent", result.sanitizedMdd);
    void this.persistMddDeliveryGateSnapshot(
      stageId,
      await evaluateMddDeliveryGatePrepared(result.sanitizedMdd),
    );
    return {
      sanitizedMdd: result.sanitizedMdd,
      status: result.status,
      precisionScore: result.precisionScore,
    };
  }

  private buildStageDocumentUpdate(
    documentMeta?: PersistMddFromPatchInput["documentMeta"],
  ): Pick<Prisma.StageUpdateInput, "documentAst" | "documentVersion"> {
    if (documentMeta === undefined) return {};
    return {
      documentAst:
        documentMeta.documentAst === null
          ? Prisma.JsonNull
          : (documentMeta.documentAst as Prisma.InputJsonValue),
      documentVersion: documentMeta.documentVersion ?? undefined,
    };
  }
}
