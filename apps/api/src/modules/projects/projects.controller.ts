import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { requireAdmin } from "../../common/guards/role.helpers.js";
import { DeliverablesQueueService, type GenerateJobType } from "./deliverables-queue.service.js";
import { ProjectGenerationGuardService } from "./project-generation-guard.service.js";
import { ProjectMergeService } from "./project-merge.service.js";
import { ProjectsService } from "./projects.service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  phase0DeepResearchBodySchema,
  generateAemBodySchema,
  convergeBodySchema,
  convergeTriggerBodySchema,
  clarifySpecBodySchema,
  tasksToIssuesBodySchema,
} from "@theforge/shared-types";
import { SddIntegrationService } from "./sdd-integration.service.js";
import { PlanValidationService } from "./plan-validation.service.js";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly projectMerge: ProjectMergeService,
    private readonly deliverablesQueue: DeliverablesQueueService,
    private readonly generationGuard: ProjectGenerationGuardService,
    private readonly sddIntegration: SddIntegrationService,
    private readonly planValidation: PlanValidationService,
  ) {}

  @Post("merge")
  mergeProjects(@Body() body: unknown) {
    return this.projectMerge.merge(body);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.projects.create(createProjectSchema.parse(body));
  }

  @Get()
  findAll() {
    return this.projects.findAll();
  }

  @Get(":projectId/stages")
  listStages(@Param("projectId") projectId: string) {
    return this.projects.listStages(projectId);
  }

  @Post(":projectId/stages")
  createStage(@Param("projectId") projectId: string, @Body() body: unknown) {
    return this.projects.createStage(projectId, body ?? {});
  }

  @Patch(":projectId/stages/:stageId")
  patchStage(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Body() body: unknown,
  ) {
    return this.projects.patchStage(projectId, stageId, body ?? {});
  }

  @Get(":projectId/stages/:stageId")
  getStageDetail(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
  ) {
    return this.projects.getStageDetail(projectId, stageId);
  }

  @Post(":projectId/stages/:stageId/transition")
  transitionStage(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
    @Body() body: unknown,
  ) {
    return this.projects.transitionStage(projectId, stageId, body ?? {});
  }

  @Get(":projectId/stages/:stageId/deliverables")
  getStageDeliverables(
    @Param("projectId") projectId: string,
    @Param("stageId") stageId: string,
  ) {
    return this.projects.getStageDeliverables(projectId, stageId);
  }

  /** Estado de un job de cola (polling). */
  @Get(":id/deliverables-jobs/:jobId")
  async deliverablesJobStatus(
    @Param("id") projectId: string,
    @Param("jobId") jobId: string,
  ) {
    const status = await this.deliverablesQueue.getJobStatus(jobId);
    if (status.status === "unknown") throw new NotFoundException("Job no encontrado");
    const data = status as any;
    if (data.projectId !== projectId) throw new ForbiddenException();
    return status;
  }

  /** SSE: progreso de cascada de entregables en cola BullMQ (`REDIS_URL`). */
  @Get(":id/deliverables-jobs/:jobId/stream")
  async deliverablesJobStream(
    @Param("jobId") jobId: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const status = await this.deliverablesQueue.getJobStatus(jobId);
    if (status.status === "unknown") throw new NotFoundException("Job no encontrado");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const tick = async () => {
      const s = await this.deliverablesQueue.getJobStatus(jobId);
      res.write(`event: progress\ndata: ${JSON.stringify({ state: s.status, progress: s.progress })}\n\n`);
      if (s.status === "completed") {
        res.write(`event: completed\ndata: ${JSON.stringify(s.result ?? null)}\n\n`);
        res.end();
        return;
      }
      if (s.status === "failed") {
        res.write(`event: failed\ndata: ${JSON.stringify({ message: s.error })}\n\n`);
        res.end();
        return;
      }
      if (s.status === "retrying") {
        res.write(`event: retrying\ndata: ${JSON.stringify({ message: s.error })}\n\n`);
        // Seguir sondeando en vez de terminar — el worker reintentará
      }
      setTimeout(() => void tick(), 900);
    };
    void tick();
  }

  /** Estado genérico de cualquier job (para polling desde frontend). */
  @Get("jobs/:jobId")
  async jobStatus(@Param("jobId") jobId: string) {
    const status = await this.deliverablesQueue.getJobStatus(jobId);
    if (status.status === "unknown") throw new NotFoundException("Job no encontrado");
    return status;
  }

  /** Indica si Hermes Agent está configurado (env vars presentes). */
  @Get("hermes-status")
  hermesStatus() {
    const configured = !!(process.env.HERMES_WEBHOOK_URL?.trim() && process.env.HERMES_API_KEY?.trim());
    return { configured };
  }

  @Get(":id/generation-status")
  async generationStatus(@Param("id") id: string) {
    const status = await this.generationGuard.getStatus(id);
    const { complexity: _c, contentReady: _r, ...publicStatus } = status;
    return publicStatus;
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.projects.findOne(id);
  }

  @Get(":id/conformance")
  getConformance(@Param("id") id: string, @Query("useLlm") useLlm?: string) {
    return this.projects.getConformance(id, { useLlm: useLlm === "true" });
  }

  /** Bundle SDD compatible con spec-kit (JSON para cliente o integraciones). */
  @Get(":id/export/sdd-bundle")
  exportSddBundle(@Param("id") id: string) {
    return this.sddIntegration.getExportBundle(id);
  }

  /**
   * Handoff completo para repo destino: spec-kit + agent governance + IMPLEMENT.md + consumption guide.
   */
  @Get(":id/export/repo-handoff")
  exportRepoHandoff(@Param("id") id: string) {
    return this.sddIntegration.getRepoHandoffExport(id);
  }

  /**
   * Análisis unificado cross-artifact (`/speckit.analyze` + conformidad MDD).
   */
  @Get(":id/analyze")
  analyzeArtifacts(@Param("id") id: string, @Query("stageId") stageId?: string) {
    return this.sddIntegration.analyzeArtifacts(id, stageId?.trim() || undefined);
  }

  /**
   * Clarify Spec pre-MDD (`/speckit.clarify`). Body: `{ persist?: boolean, notes?: string }`.
   */
  @Post(":id/clarify-spec")
  clarifySpec(@Param("id") id: string, @Body() body: unknown) {
    const parsed = clarifySpecBodySchema.parse(body ?? {});
    return this.sddIntegration.clarifySpec(id, parsed);
  }

  /**
   * Siguiente tarea abierta desde tasks.md (hint para MCP / implement).
   */
  @Get(":id/next-task")
  nextImplementationTask(@Param("id") id: string) {
    return this.sddIntegration.loadProjectForNextTask(id);
  }

  /**
   * Converge brownfield: tareas abiertas + conformidad + Ariadne → nuevas tareas.
   * Body opcional: `{ "persist": true }` para guardar en `tasksContent`.
   */
  @Post(":id/converge")
  converge(
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("stageId") stageId?: string,
  ) {
    const { persist } = convergeBodySchema.parse(body ?? {});
    return this.sddIntegration.converge(id, persist, stageId?.trim() || undefined);
  }

  /**
   * CI/webhook hook: runs converge (optional persist) and POSTs payload to CONVERGE_WEBHOOK_URL or body.webhookUrl.
   */
  @Post(":id/converge/trigger")
  convergeTrigger(
    @Param("id") id: string,
    @Body() body: unknown,
    @Query("stageId") stageId?: string,
  ) {
    const parsed = convergeTriggerBodySchema.parse(body ?? {});
    return this.sddIntegration.triggerConverge(id, parsed, stageId?.trim() || undefined);
  }

  /** Gate 2: validate change plan (Tasks + legacy state) against Ariadne graph. */
  @Post(":id/validate-change-plan")
  validateChangePlan(@Param("id") id: string, @Query("stageId") stageId?: string) {
    return this.planValidation.validateProjectChangePlan(id, stageId?.trim() || undefined);
  }

  /** Last persisted plan validation for the active or given stage. */
  @Get(":id/plan-validation")
  getPlanValidation(@Param("id") id: string, @Query("stageId") stageId?: string) {
    return this.planValidation
      .getPlanValidationForProject(id, stageId?.trim() || undefined)
      .then((validation) => ({ validation }));
  }

  /**
   * Crea GitHub Issues desde tareas abiertas de `tasks.md`.
   * Requiere `GITHUB_TOKEN` en el servidor. `dryRun: true` solo planifica.
   */
  @Post(":id/tasks-to-issues")
  tasksToIssues(@Param("id") id: string, @Body() body: unknown) {
    const parsed = tasksToIssuesBodySchema.parse(body ?? {});
    return this.sddIntegration.tasksToIssues(id, parsed);
  }

  @Post(":id/clone")
  cloneProject(@Param("id") id: string, @Body() body: unknown) {
    return this.projects.cloneProject(id, body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.projects.update(id, updateProjectSchema.partial().parse(body));
  }

  @Post(":id/generate-benchmark")
  generateBenchmark(
    @Param("id") id: string,
    @Body() body: { userIdea?: string; urls?: string[] },
  ) {
    const userIdea = typeof body?.userIdea === "string" ? body.userIdea : "";
    const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => typeof u === "string") : undefined;
    return this.projects.generateBenchmark(id, userIdea, urls);
  }

  /** Greenfield: borrador BRD desde `dbgaContent` (To-Be eliminado del sistema). */
  @Post(":id/suggest-brd-from-dbga")
  @Post(":id/suggest-brd-tobe-from-dbga")
  suggestBrdFromDbga(
    @Param("id") id: string,
    @Body() body: { stageId?: string },
  ) {
    const stageId = typeof body?.stageId === "string" ? body.stageId : undefined;
    return this.projects.suggestBrdFromDbga(id, { stageId });
  }

  @Post(":id/phase0-deep-research")
  phase0DeepResearch(@Param("id") id: string, @Body() body: unknown) {
    const parsed = phase0DeepResearchBodySchema.parse(body ?? {});
    return this.projects.phase0DeepResearch(id, {
      userIdea: parsed.userIdea,
      urls: parsed.urls,
      includeBenchmark: parsed.includeBenchmark,
    });
  }

  /** Genera AEM (Análisis y Estudio de Mercado) desde Benchmark, Fase 0 y BRD. */
  @Post(":id/generate-aem")
  generateAem(@Param("id") id: string, @Body() body: unknown) {
    const parsed = generateAemBodySchema.parse(body ?? {});
    return this.projects.generateAem(id, parsed);
  }

  /**
   * Cascada de entregables según `Project.complexity`.
   * Con `REDIS_URL`: encola BullMQ y responde `{ queued: true, jobId }`.
   */
  @Post(":id/generate-deliverables")
  async generateDeliverablesCascade(
    @Param("id") id: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    const ack = acknowledgeGaps === "true";
    await this.projects.assertDeliverablesAllowed(id, { acknowledgeGaps: ack });
    const jobId = await this.deliverablesQueue.enqueue({
      type: "cascade",
      projectId: id,
      acknowledgeGaps: ack,
    });
    return {
      queued: true,
      jobId,
      statusPath: `/projects/${id}/deliverables-jobs/${jobId}`,
    };
  }

  /** Aplica `complexityPending` a `complexity` y limpia HITL. */
  @Post(":id/confirm-complexity")
  confirmComplexity(@Param("id") id: string) {
    return this.projects.confirmComplexityProposal(id);
  }

  /** Re-infiere propuesta HITL desde DBGA/MDD existentes. */
  @Post(":id/reassess-complexity")
  reassessComplexity(@Param("id") id: string, @Body() body: { note?: string }) {
    return this.projects.reassessComplexity(id, { note: body?.note });
  }

  @Post(":id/generate-spec")
  generateSpec(
    @Param("id") id: string,
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    return this.queueOrSync(id, "spec", {}, queue, acknowledgeGaps);
  }

  @Post(":id/generate-tasks")
  generateTasks(
    @Param("id") id: string,
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    return this.queueOrSync(id, "tasks", {}, queue, acknowledgeGaps);
  }

  @Post(":id/generate-agent-governance")
  generateAgentGovernance(
    @Param("id") id: string,
    @Body() body: { preview?: boolean; target?: string; force?: boolean },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    console.warn(
      `[agent-gov] POST generate-agent-governance projectId=${id} force=${body?.force} queue=${queue ?? "(sync)"} preview=${body?.preview ?? false}`,
    );
    if (body?.preview) {
      return this.projects.generateAgentGovernancePreview(id, body?.target, {
        forceRegenerate: body?.force !== false,
      });
    }
    return this.queueOrSync(
      id,
      "agent-governance",
      { preview: false, target: body?.target, forceRegenerate: body?.force !== false },
      queue,
      acknowledgeGaps,
    );
  }

  @Get(":id/agent-governance-export")
  getAgentGovernanceExport(@Param("id") id: string) {
    return this.projects.getAgentGovernanceForExport(id);
  }

  @Post(":id/repair-ux-ui-guide")
  repairUxUiGuide(@Param("id") id: string) {
    return this.projects.repairUxUiGuideYaml(id);
  }

  @Post(":id/compose-ux-guide-from-ref")
  composeUxGuideFromDesignRef(@Param("id") id: string) {
    return this.projects.composeUxGuideFromDesignRef(id);
  }

  @Post(":id/generate-architecture")
  generateArchitecture(
    @Param("id") id: string,
    @Body() body: { preview?: boolean },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    if (body?.preview) return this.projects.generateArchitecturePreview(id);
    return this.queueOrSync(id, "architecture", { preview: false }, queue, acknowledgeGaps);
  }

  @Post(":id/generate-use-cases")
  generateUseCases(
    @Param("id") id: string,
    @Body() body: { preview?: boolean },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    if (body?.preview) return this.projects.generateUseCasesPreview(id);
    return this.queueOrSync(id, "use-cases", { preview: false }, queue, acknowledgeGaps);
  }

  @Post(":id/generate-user-stories")
  generateUserStories(
    @Param("id") id: string,
    @Body() body: { preview?: boolean },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    if (body?.preview) return this.projects.generateUserStoriesPreview(id);
    return this.queueOrSync(id, "user-stories", { preview: false }, queue, acknowledgeGaps);
  }

  @Post(":id/generate-blueprint")
  generateBlueprint(
    @Param("id") id: string,
    @Body() body: { preview?: boolean; gapsFeedback?: string },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    if (body?.preview) return this.projects.generateBlueprintPreview(id, gaps);
    return this.queueOrSync(
      id,
      "blueprint",
      { preview: false, gapsFeedback: gaps ?? null },
      queue,
      acknowledgeGaps,
    );
  }

  @Post(":id/generate-api-contracts")
  generateApiContracts(
    @Param("id") id: string,
    @Body() body: { preview?: boolean; gapsFeedback?: string },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    if (body?.preview) return this.projects.generateApiContractsPreview(id, gaps);
    return this.queueOrSync(
      id,
      "api-contracts",
      { preview: false, gapsFeedback: gaps ?? null },
      queue,
      acknowledgeGaps,
    );
  }

  @Post(":id/generate-logic-flows")
  generateLogicFlows(
    @Param("id") id: string,
    @Body() body: { gapsFeedback?: string },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    return this.queueOrSync(id, "logic-flows", { gapsFeedback: gaps ?? null }, queue, acknowledgeGaps);
  }

  @Post(":id/generate-infra")
  generateInfra(
    @Param("id") id: string,
    @Body() body: { preview?: boolean; gapsFeedback?: string },
    @Query("queue") queue?: string,
    @Query("acknowledgeGaps") acknowledgeGaps?: string,
  ) {
    const gaps = typeof body?.gapsFeedback === "string" ? body.gapsFeedback.trim() || undefined : undefined;
    if (body?.preview) return this.projects.generateInfraPreview(id, gaps);
    return this.queueOrSync(
      id,
      "infra",
      { preview: false, gapsFeedback: gaps ?? null },
      queue,
      acknowledgeGaps,
    );
  }

  @Post(":id/verify-deliverable")
  verifyDeliverable(
    @Param("id") id: string,
    @Body() body: { deliverable?: "blueprint" | "api" | "infra" | "logicFlows" },
  ) {
    const deliverable = body?.deliverable ?? "blueprint";
    return this.projects.verifyDeliverable(id, deliverable);
  }

  /** Notifica a Hermes Agent que este proyecto está listo para desarrollo. */
  @Post(":id/launch-hermes")
  launchHermes(@Param("id") id: string) {
    return this.projects.launchHermes(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    requireAdmin();
    return this.projects.remove(id);
  }

  @Get("favorites")
  listFavorites() {
    return this.projects.getUserFavoriteIds().then((s) => Array.from(s));
  }

  @Post(":id/favorite")
  toggleFavorite(@Param("id") id: string) {
    return this.projects.toggleFavorite(id);
  }

  /**
   * Helper: encola el job por defecto (`?queue=true` implícito).
   * Pasa `?queue=false` solo para ejecución síncrona (integraciones/MCP).
   * Con Redis responde `{ queued: true, jobId }`; sin Redis, fire-and-forget in-memory secuencial.
   */
  private async queueOrSync(
    projectId: string,
    type: GenerateJobType,
    extra: Record<string, unknown>,
    queueParam?: string,
    acknowledgeGapsParam?: string,
  ): Promise<unknown> {
    const acknowledgeGaps = acknowledgeGapsParam === "true";
    const isPreview = (extra.preview as boolean) ?? false;
    if (!isPreview && type !== "doc-reconcile-partial") {
      await this.projects.assertDeliverablesAllowed(projectId, { acknowledgeGaps });
    }
    const wantQueue = queueParam !== "false";
    const canQueue = wantQueue && this.deliverablesQueue.isEnabled();
    if (canQueue) {
      const jobId = await this.deliverablesQueue.enqueue({
        type,
        projectId,
        preview: (extra.preview as boolean) ?? false,
        gapsFeedback: (extra.gapsFeedback as string | null) ?? null,
        target: (extra.target as string | undefined) ?? undefined,
        forceRegenerate: extra.forceRegenerate !== false,
        acknowledgeGaps,
      });
      return { queued: true, jobId, statusPath: `/projects/jobs/${jobId}` };
    }

    // Cliente pidió cola pero Redis no está → fire-and-forget secuencial por proyecto
    if (wantQueue) {
      if (type === "agent-governance" && extra.forceRegenerate !== false) {
        console.warn(
          `[agent-gov] queueOrSync fire-and-forget clearing content projectId=${projectId} forceRegenerate=true`,
        );
        await this.projects.clearAgentGovernanceContent(projectId);
      }
      const bgJobId = `bg-${Date.now()}-${type}`;
      await this.generationGuard.assertCanEnqueue(projectId, type);
      this.generationGuard.registerBackgroundJob(bgJobId, projectId, type);
      void this.fireAndForget(type, projectId, extra, acknowledgeGaps, bgJobId).catch((err) => {
        console.error(`[fire-and-forget] ${type} falló para ${projectId}: ${err instanceof Error ? err.message : err}`);
        this.generationGuard.finishBackgroundJob(bgJobId);
      });
      return {
        queued: true,
        jobId: bgJobId,
        statusPath: `/projects/${projectId}/generation-status`,
        note: "Sin Redis: job en background secuencial por proyecto. Consulta generation-status o recarga el proyecto.",
      };
    }

    // Fallback síncrono (sin ?queue=true explícito)
    const result = await this.runGenerateJobSync(type, projectId, extra);
    if (type !== "agent-governance" && type !== "cascade") {
      await this.projects.runPostRegenSddConflictSurfacing(projectId).catch((err) => {
        console.warn(
          `[queueOrSync] sddConflictSurfacing (${type}): ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
    return result;
  }

  private async runGenerateJobSync(
    type: GenerateJobType,
    projectId: string,
    extra: Record<string, unknown>,
  ): Promise<unknown> {
    switch (type) {
      case "blueprint":
        return this.projects.generateBlueprint(projectId, (extra.gapsFeedback as string | undefined) ?? undefined);
      case "api-contracts":
        return this.projects.generateApiContracts(projectId, (extra.gapsFeedback as string | undefined) ?? undefined);
      case "logic-flows":
        return this.projects.generateLogicFlows(projectId, (extra.gapsFeedback as string | undefined) ?? undefined);
      case "tasks":
        return this.projects.generateTasks(projectId);
      case "agent-governance":
        return this.projects.generateAgentGovernance(projectId, extra.target as string | undefined, {
          forceRegenerate: extra.forceRegenerate !== false,
        });
      case "infra":
        return this.projects.generateInfra(projectId, (extra.gapsFeedback as string | undefined) ?? undefined);
      case "architecture":
        return this.projects.generateArchitecture(projectId);
      case "use-cases":
        return this.projects.generateUseCases(projectId);
      case "user-stories":
        return this.projects.generateUserStories(projectId);
      case "spec":
        return this.projects.generateSpec(projectId);
      default:
        return this.projects.generateBlueprint(projectId);
    }
  }

  /** Fire-and-forget: ejecuta la generación en background sin esperar respuesta. */
  private async fireAndForget(
    type: GenerateJobType,
    projectId: string,
    extra: Record<string, unknown>,
    acknowledgeGaps = false,
    bgJobId?: string,
  ): Promise<void> {
    if (bgJobId) this.generationGuard.markBackgroundJobActive(bgJobId);
    if (!((extra.preview as boolean) ?? false) && type !== "doc-reconcile-partial") {
      await this.projects.assertDeliverablesAllowed(projectId, { acknowledgeGaps });
    }
    try {
      await this.runGenerateJobSync(type, projectId, extra);
      if (type !== "agent-governance" && type !== "cascade") {
        await this.projects.runPostRegenSddConflictSurfacing(projectId).catch((err) => {
          console.warn(
            `[fire-and-forget] sddConflictSurfacing (${type}): ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    } finally {
      if (bgJobId) this.generationGuard.finishBackgroundJob(bgJobId);
    }
  }
}
