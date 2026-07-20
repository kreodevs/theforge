import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { getLegacyChangeState } from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { TheForgeService } from "../theforge/theforge.service.js";
import {
  gatherLegacyIndexSignals,
  legacyIndexHasUsableGraphEvidence,
  type LegacyIndexSignalsGathered,
} from "../theforge/theforge-evidence-context.util.js";
import { GraphMemoryService } from "../ai-analysis/graph-memory/graph-memory.service.js";
import { evaluateLegacyIndexSddGate } from "./legacy-index-sdd-alignment.util.js";
import { isLegacyBaselineStage, pickPrimaryStage } from "../projects/stage-helpers.js";
import { isLegacySddIndexGateEnabled } from "./legacy-coordinator.util.js";
import type { LegacyFlowState } from "./legacy-coordinator.types.js";

@Injectable()
export class LegacyStageContextService {
  private readonly logger = new Logger(LegacyStageContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    private readonly theforge: TheForgeService,
    private readonly graphMemory: GraphMemoryService,
  ) {}

  async getLegacyProject(projectId: string) {
    const project = await this.projects.findOne(projectId);
    const pt = (project as { projectType?: string }).projectType;
    if (pt !== "LEGACY") {
      throw new BadRequestException("El flujo legacy solo aplica a proyectos con projectType LEGACY.");
    }
    const theforgeId = (project as { theforgeProjectId?: string | null }).theforgeProjectId;
    if (!theforgeId?.trim()) {
      throw new BadRequestException("El proyecto legacy debe tener theforgeProjectId configurado.");
    }
    return { project, theforgeId };
  }

  async resolveLegacyGateStage(projectId: string) {
    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: { orderBy: { ordinal: "asc" } } },
    });
    if (!row?.stages?.length) return null;
    const legacyMarked = row.stages.filter((s) => s.isLegacy);
    const pool = legacyMarked.length > 0 ? legacyMarked : row.stages;
    const picked = pickPrimaryStage(pool);
    if (!picked?.id) return null;
    return this.prisma.stage.findUnique({ where: { id: picked.id } });
  }

  readLegacyChangeState(stage: { legacyChangeState?: unknown } | null): LegacyFlowState {
    return getLegacyChangeState(stage) as LegacyFlowState;
  }

  async persistLegacyChangeState(_projectId: string, stageId: string, state: LegacyFlowState): Promise<void> {
    await this.prisma.stage.update({
      where: { id: stageId },
      data: { legacyChangeState: state as object },
    });
  }

  async syncCurrentLegacyStageToGraph(projectId: string, stageId: string): Promise<void> {
    try {
      const [stage, project] = await Promise.all([
        this.prisma.stage.findUnique({ where: { id: stageId } }),
        this.prisma.project.findUnique({
          where: { id: projectId },
          select: { theforgeProjectId: true },
        }),
      ]);
      if (!stage) {
        this.logger.warn(`[LegacyCoordinator] syncCurrentLegacyStage: stage ${stageId} no encontrada`);
        return;
      }
      let parentStageId: string | undefined;
      if (stage.ordinal > 1) {
        const baseline = await this.prisma.stage.findFirst({
          where: { projectId: stage.projectId, ordinal: stage.ordinal - 1 },
          select: { id: true },
        });
        if (baseline) parentStageId = baseline.id;
      }
      await this.graphMemory.syncLegacyStage({
        stageId: stage.id,
        projectId,
        ordinal: stage.ordinal,
        name: stage.name ?? "",
        description: (stage as { description?: string | null }).description ?? undefined,
        parentStageId,
        theforgeProjectId: project?.theforgeProjectId ?? undefined,
      });
    } catch (err) {
      this.logger.warn(
        `[LegacyCoordinator] syncCurrentLegacyStageToGraph falló (no crítico): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async assertLegacyIndexSddGate(
    projectId: string,
    theforgeId: string,
    legacyState: LegacyFlowState,
    options?: { semanticQueries?: readonly string[] },
  ): Promise<LegacyIndexSignalsGathered | null> {
    if (!isLegacySddIndexGateEnabled()) return null;
    if (this.hasLegacyIndexSddResolution(legacyState)) return null;

    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { stages: true },
    });
    const stageId = row?.stages?.length ? pickPrimaryStage(row.stages)?.id : undefined;
    if (!stageId?.trim()) return null;

    const snapshot = await this.graphMemory.getSddStageSnapshot(projectId, stageId);
    if (!snapshot) return null;

    const gathered = await gatherLegacyIndexSignals(this.theforge, theforgeId, {
      semanticQueries: options?.semanticQueries,
    });
    const hasUsable = legacyIndexHasUsableGraphEvidence(gathered.semanticChunks, gathered.chosenPaths);
    const indexBlobLower = [gathered.mergedSemantic, ...gathered.chosenPaths, ...gathered.semanticChunks]
      .join("\n")
      .toLowerCase();

    const gate = evaluateLegacyIndexSddGate(
      {
        semanticChunks: gathered.semanticChunks,
        chosenPaths: gathered.chosenPaths,
        indexBlobLower,
      },
      snapshot,
      hasUsable,
    );

    if (!gate.blocking) return gathered;

    throw new ConflictException({
      code: "LEGACY_INDEX_SDD_MISMATCH",
      message: gate.summary,
      gate,
    });
  }

  private hasLegacyIndexSddResolution(state: LegacyFlowState): boolean {
    const r = state.legacyIndexSddResolution;
    return typeof r?.choice === "string" && typeof r?.resolvedAt === "string" && r.resolvedAt.length > 0;
  }
}

export { isLegacyBaselineStage };
