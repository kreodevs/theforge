import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from "@nestjs/common";
import { ComplexityLevel } from "@theforge/database";
import {
  DELIVERABLE_WAVES_BY_COMPLEXITY,
  TASKS_PREFLIGHT_DOC_ACCURACY_BLOCK_THRESHOLD,
  flattenDeliverableWaves,
  type DeliverableKind,
  type DeliverableWaveStep,
} from "@theforge/shared-types";
import {
  buildInfraConformanceGapFeedback,
  checkApiVsMdd,
  checkInfraVsMdd,
} from "../engine/conformance.service.js";
import { buildApiRetryFeedback } from "../engine/api-conformance-repair.util.js";
import { computeCascadeAccuracy } from "../engine/cascade-accuracy.util.js";
import {
  buildCrossArtifactTraceReport,
  formatCrossArtifactTraceGaps,
} from "../engine/cross-artifact-trace.util.js";
import {
  checkModelCardinalityAlignment,
  formatModelCardinalityGaps,
} from "../engine/model-cardinality.util.js";
import {
  collectDomainInventoryConformanceGaps,
  formatDomainInventoryConformanceGaps,
} from "../engine/domain-inventory-conformance.util.js";
import { buildEntityApiTraceReport, formatEntityApiTraceGaps } from "../engine/entity-api-trace.util.js";
import { collectExternalIntegrationContractGaps } from "../engine/sdd-external-contracts.util.js";
import { checkBrdDecisionLogClosure } from "../engine/brd-decision-log.util.js";
import {
  collectSddPrecisionGaps,
  formatPrecisionGapsFeedback,
  precisionGapsForPostPassRetry,
} from "../engine/sdd-precision-checks.util.js";
import { UiMcpClientService } from "../ui-mcp/ui-mcp-client.service.js";
import { UiScreensService } from "../ui-mcp/ui-screens.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import { buildConstitutionMarkdown } from "./constitution-markdown.util.js";
import { buildExistingConformanceGapsMap } from "./deliverables-cascade-gaps.util.js";
import { syncDomainInventoryForStage } from "./sync-domain-inventory-stage.util.js";
import { persistStageDeliverableSnapshotFromProject } from "./stage-deliverable-snapshot.util.js";
import {
  persistDeliverableBundleAtomic,
  pickDeliverableBundleFields,
} from "./deliverable-bundle-persist.util.js";
import { pickPrimaryStage } from "./stage-helpers.js";
import { ProjectsService } from "./projects.service.js";
import { resolveDomainInventory } from "../engine/domain-inventory-persist.util.js";
import type { DomainInventory } from "@theforge/shared-types";

export type DeliverablesCascadeProgress = {
  step: string;
  completedSteps: string[];
  index: number;
  total: number;
};

@Injectable()
export class DeliverablesCascadeService {
  private readonly logger = new Logger(DeliverablesCascadeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    private readonly uiMcpClient: UiMcpClientService,
    private readonly uiScreens: UiScreensService,
  ) {}

  /** Sync pantallas tras W2; no falla la cascada si no hay MCP activo. */
  async syncUiScreens(projectId: string): Promise<void> {
    try {
      if (!(await this.uiMcpClient.isActive())) {
        this.logger.debug("[Cascade] ui_screens_sync omitido — MCP gráfico inactivo");
        return;
      }
      await this.uiScreens.syncUiScreens(projectId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[Cascade] ui_screens_sync saltado: ${message}`);
    }
  }

  /**
   * Enrutamiento dinámico: solo ejecuta generadores listados en `DELIVERABLES_BY_COMPLEXITY`.
   * @param onProgress — opcional (p. ej. BullMQ `job.updateProgress`).
   */
  async generateDeliverablesCascade(
    projectId: string,
    onProgress?: (p: DeliverablesCascadeProgress) => void,
    options?: { acknowledgeGaps?: boolean; signal?: AbortSignal },
  ) {
    await this.projects.assertDeliverablesAllowed(projectId, options);
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
    await syncDomainInventoryForStage(this.prisma, project).catch((err) =>
      this.logger.warn(
        `[Cascade] syncDomainInventory: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    if (project.projectType === "LEGACY") {
      throw new BadRequestException("Usa el flujo de entregables legacy del proyecto.");
    }
    if (project.complexityPending != null) {
      throw new BadRequestException(
        "Hay una propuesta de complejidad pendiente de confirmación. Confirma o rechaza en el chat del Workshop antes de generar entregables.",
      );
    }
    const c = project.complexity ?? ComplexityLevel.HIGH;
    const waves = DELIVERABLE_WAVES_BY_COMPLEXITY[c];
    const flatSteps = flattenDeliverableWaves(c);
    const total = flatSteps.length + 1;
    const errors: { step: string; error: string }[] = [];

    let completedCount = 0;
    const completedSteps: string[] = [];
    const reportProgress = (step: DeliverableWaveStep) => {
      const progressKey = step === "ui_screens_sync" ? "ui_screens_sync" : step;
      completedSteps.push(progressKey);
      onProgress?.({
        step: progressKey,
        completedSteps: [...completedSteps],
        index: completedCount,
        total,
      });
      completedCount++;
    };

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      if (options?.signal?.aborted) {
        throw new Error("Cancelado por el usuario");
      }
      const wave = waves[waveIndex]!;
      const projectFresh = await this.projects.findOne(projectId);
      const mddContent = buildConstitutionMarkdown(projectFresh);
      const gapsMap = buildExistingConformanceGapsMap(projectFresh, mddContent, wave);

      await Promise.allSettled(
        wave.map(async (step: DeliverableWaveStep) => {
          try {
            const stepGaps = step !== "ui_screens_sync" ? gapsMap.get(step) : undefined;
            await this.runDeliverableWaveStep(
              step,
              projectId,
              stepGaps ?? undefined,
              options?.acknowledgeGaps === true,
            );
          } catch (e) {
            const message = e instanceof Error ? e.message : "Error desconocido";
            this.logger.warn(`[Cascade] Paso ${step} saltado: ${message}.`);
            errors.push({ step, error: message });
          }
          reportProgress(step);
        }),
      );
    }

    const projectAfterWaves = await this.projects.findOne(projectId);
    const stageAfterWaves = pickPrimaryStage(projectAfterWaves.stages ?? []);
    if (stageAfterWaves?.id) {
      await persistDeliverableBundleAtomic(
        this.prisma,
        stageAfterWaves.id,
        projectId,
        pickDeliverableBundleFields(projectAfterWaves),
      ).catch((err) =>
        this.logger.warn(
          `[Cascade] bundle atomic persist: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }

    onProgress?.({
      step: "post_pass_w4",
      completedSteps: [...completedSteps],
      index: completedCount,
      total,
    });

    await this.runCascadePostPassRetry(projectId).catch((err) =>
      this.logger.warn(
        `[Cascade] post-pass W4: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );

    await this.runCascadeConformanceRetry(projectId).catch((err) =>
      this.logger.warn(
        `[Cascade] conformance retry: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );

    await this.projects.refreshStageSemaphoreFromProject(projectId).catch((err) =>
      this.logger.warn(
        `[Cascade] refresh semaphore: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );

    onProgress?.({ step: "done", completedSteps: [...completedSteps], index: total - 1, total });
    if (errors.length > 0) {
      this.logger.warn(
        `[Cascade] Completada con ${errors.length}/${total} paso(s) saltado(s): ${errors.map((e) => `${e.step}: ${e.error}`).join("; ")}`,
      );
    }
    const result = await this.projects.findOne(projectId);
    const activeStage = pickPrimaryStage(result.stages ?? []);
    if (activeStage?.id) {
      await persistStageDeliverableSnapshotFromProject(this.prisma, activeStage.id, result, {
        source: "cascade",
      }).catch((err) =>
        this.logger.warn(
          `[Cascade] deliverableSnapshot: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      await this.projects.runPostRegenSddConflictSurfacing(result.id).catch((err) =>
        this.logger.warn(
          `[Cascade] sddConflictSurfacing: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
    return result;
  }

  private async runDeliverableWaveStep(
    step: DeliverableWaveStep,
    projectId: string,
    gapsFeedback?: string | null,
    acknowledgeGaps?: boolean,
  ): Promise<void> {
    if (step === "ui_screens_sync") {
      await this.syncUiScreens(projectId);
      return;
    }
    await this.projects.generateDocument(step as DeliverableKind, projectId, {
      gapsFeedback: gapsFeedback ?? undefined,
      acknowledgeGaps,
    });
  }

  /** W4: reintenta artefactos con gaps de precisión SDD o TaskAccuracy < 90. */
  private async runCascadePostPassRetry(projectId: string): Promise<void> {
    const project = await this.projects.findOne(projectId);
    const mdd = buildConstitutionMarkdown(project);
    const stage = pickPrimaryStage(project.stages ?? []);
    const precisionGaps = collectSddPrecisionGaps({
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
    });

    const accuracy = computeCascadeAccuracy({
      brdMarkdown: stage?.brdContent,
      dbgaMarkdown: project.dbgaContent,
      mddMarkdown: mdd,
      tasksMarkdown: project.tasksContent,
      logicFlowsMarkdown: project.logicFlowsContent,
      apiContractsMarkdown: project.apiContractsContent,
      uiScreensMarkdown: project.uiScreensContent,
      userStoriesMarkdown: project.userStoriesContent,
      useCasesMarkdown: project.useCasesContent,
      specMarkdown: project.specContent,
    });

    const taskGaps: string[] = [];
    if (!accuracy.tasks.ok) {
      const detail = [
        ...accuracy.tasks.blockers,
        ...accuracy.tasks.components.flatMap((c) => c.gaps),
      ]
        .filter(Boolean)
        .slice(0, 12);
      taskGaps.push(
        `TaskAccuracy=${accuracy.tasks.score} < 90. ${detail.join("; ") || "mejorar cobertura dominio→task / CRUD / anti auth-skew"}`,
      );
    }

    const crossTrace = buildCrossArtifactTraceReport({
      userStoriesMarkdown: project.userStoriesContent,
      uiScreensMarkdown: project.uiScreensContent,
      apiContractsMarkdown: project.apiContractsContent,
      tasksMarkdown: project.tasksContent,
    });
    const crossGaps = formatCrossArtifactTraceGaps(crossTrace, 16);

    const inventory = resolveDomainInventory({
      persisted: stage?.domainInventory as DomainInventory | null | undefined,
      brdMarkdown: stage?.brdContent,
      dbgaMarkdown: project.dbgaContent,
      mddMarkdown: mdd,
    });

    const cardinality = checkModelCardinalityAlignment({
      mddMarkdown: mdd,
      inventory,
      tasksMarkdown: project.tasksContent,
    });
    const cardinalityGaps = formatModelCardinalityGaps(cardinality);

    const invConf = collectDomainInventoryConformanceGaps({
      brdMarkdown: stage?.brdContent,
      dbgaMarkdown: project.dbgaContent,
      mddMarkdown: mdd,
      inventory,
    });
    const invConfGaps = formatDomainInventoryConformanceGaps(invConf, 10);

    const entityTraceGaps = formatEntityApiTraceGaps(
      buildEntityApiTraceReport({
        mddMarkdown: mdd,
        inventory,
        apiContractsMarkdown: project.apiContractsContent,
      }),
      10,
    );

    const externalGaps = collectExternalIntegrationContractGaps({
      dbgaMarkdown: project.dbgaContent,
      brdMarkdown: stage?.brdContent,
      mddMarkdown: mdd,
      apiContractsMarkdown: project.apiContractsContent,
      architectureMarkdown: project.architectureContent,
      infraMarkdown: project.infraContent,
    });

    const brdLogGaps = stage?.brdContent?.trim()
      ? [
          ...checkBrdDecisionLogClosure(stage.brdContent).blockers,
          ...checkBrdDecisionLogClosure(stage.brdContent).warnings,
        ]
      : [];

    const allGaps = [
      ...precisionGaps,
      ...taskGaps,
      ...crossGaps,
      ...cardinalityGaps,
      ...invConfGaps,
      ...entityTraceGaps,
      ...externalGaps,
      ...brdLogGaps,
    ];
    if (allGaps.length === 0) return;

    const feedback = formatPrecisionGapsFeedback(allGaps);
    const flags = precisionGapsForPostPassRetry(precisionGaps);
    if (taskGaps.length > 0 || crossGaps.length > 0 || cardinalityGaps.length > 0) {
      flags.retryTasks = true;
    }
    if (invConfGaps.length > 0 || entityTraceGaps.length > 0 || externalGaps.length > 0) {
      flags.retryApiContracts = true;
      flags.retryArchitecture = true;
    }

    this.logger.warn(
      `[Cascade] Post-pase W4: ${allGaps.length} gap(s) (precision=${precisionGaps.length}, taskAccuracy=${accuracy.tasks.score}) — retry dirigido`,
    );

    const upstreamRetries: Array<Promise<unknown>> = [];
    if (flags.retryArchitecture) {
      upstreamRetries.push(
        this.projects.generateArchitecture(projectId, feedback).catch((e) =>
          this.logger.warn(`[Cascade] W4 architecture retry: ${e instanceof Error ? e.message : e}`),
        ),
      );
    }
    if (flags.retryLogicFlows) {
      upstreamRetries.push(
        this.projects.generateLogicFlows(projectId, feedback).catch((e) =>
          this.logger.warn(`[Cascade] W4 logic-flows retry: ${e instanceof Error ? e.message : e}`),
        ),
      );
    }
    if (flags.retryApiContracts) {
      upstreamRetries.push(
        this.projects.generateApiContracts(projectId, feedback).catch((e) =>
          this.logger.warn(`[Cascade] W4 api-contracts retry: ${e instanceof Error ? e.message : e}`),
        ),
      );
    }

    if (upstreamRetries.length > 0) {
      await Promise.allSettled(upstreamRetries);
    }

    if (flags.retryTasks) {
      const docAcc = computeCascadeAccuracy({
        brdMarkdown: stage?.brdContent,
        dbgaMarkdown: project.dbgaContent,
        mddMarkdown: mdd,
        tasksMarkdown: project.tasksContent,
        logicFlowsMarkdown: project.logicFlowsContent,
        apiContractsMarkdown: project.apiContractsContent,
        uiScreensMarkdown: project.uiScreensContent,
        userStoriesMarkdown: project.userStoriesContent,
        useCasesMarkdown: project.useCasesContent,
        specMarkdown: project.specContent,
      }).doc;
      const relaxPreflight =
        docAcc.score < TASKS_PREFLIGHT_DOC_ACCURACY_BLOCK_THRESHOLD;
      await this.projects
        .generateTasks(projectId, feedback, { acknowledgeGaps: relaxPreflight })
        .catch((e) =>
          this.logger.warn(`[Cascade] W4 tasks retry: ${e instanceof Error ? e.message : e}`),
        );
    }
  }

  /** Reintenta API e Infra cuando conformance heurístico falla tras la cascada (máx. 2 iteraciones). */
  private async runCascadeConformanceRetry(projectId: string): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const project = await this.projects.findOne(projectId);
      const mdd = buildConstitutionMarkdown(project);
      if (!mdd.trim()) return;

      const apiCheck = checkApiVsMdd(mdd, project.apiContractsContent ?? null);
      const infraCheck = checkInfraVsMdd(mdd, project.infraContent ?? null);
      if (apiCheck.ok && infraCheck.ok) return;

      this.logger.warn(
        `[Cascade] Conformance retry ${attempt + 1}/2 — API ok=${apiCheck.ok} Infra ok=${infraCheck.ok}`,
      );

      const retries: Promise<unknown>[] = [];
      if (!apiCheck.ok && (project.apiContractsContent ?? "").trim().length > 80) {
        const feedback = buildApiRetryFeedback(apiCheck);
        retries.push(
          this.projects.generateApiContracts(projectId, feedback).catch((e) =>
            this.logger.warn(`[Cascade] API conformance retry: ${e instanceof Error ? e.message : e}`),
          ),
        );
      }
      if (!infraCheck.ok && (project.infraContent ?? "").trim().length > 80) {
        const feedback = buildInfraConformanceGapFeedback(infraCheck.gaps);
        retries.push(
          this.projects.generateInfra(projectId, feedback).catch((e) =>
            this.logger.warn(`[Cascade] Infra conformance retry: ${e instanceof Error ? e.message : e}`),
          ),
        );
      }
      if (retries.length === 0) return;
      await Promise.allSettled(retries);
    }
  }
}
