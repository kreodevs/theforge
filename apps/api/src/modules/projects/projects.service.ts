import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from "@nestjs/common";
import { ComplexityLevel, StageStatus } from "@theforge/database";
import type { Estimation, Project, Stage } from "@theforge/database";
import { getRequestUserId, getRequestUserRole } from "../../common/request-user.store.js";
import { isAdminOrAbove } from "../../common/roles.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { cleanDocumentContent } from "../sessions/document-content.util.js";
import { DiscoveryService } from "../ai/discovery.service.js";
import { ScraperService } from "../scraper/scraper.service.js";
import { TheForgeService } from "../theforge/theforge.service.js";
import { GraphMemoryService } from "../ai-analysis/graph-memory/graph-memory.service.js";
import type { IOrchestratorProjectsPort } from "./projects-service.port.js";
import { resolveUrls } from "../scraper/url-utils.js";
import {
  createProjectSchema,
  cloneProjectBodySchema,
  getAllowedStageTransitions,
  type DeliverableKind,
  type CreateProjectDto,
  type UpdateProjectDto,
} from "@theforge/shared-types";

import {
  loadAccessibleProjectWithStages,
} from "./project-access.util.js";
import { ProjectMddPersistService } from "./project-mdd-persist.service.js";
import { DeliverablesCascadeService } from "./deliverables-cascade.service.js";
import { ProjectStageService } from "./project-stage.service.js";
import { ProjectUxGuideService } from "./project-ux-guide.service.js";
import { ProjectDeliverableGeneratorsService } from "./project-deliverable-generators.service.js";
import { ProjectDeliverableGateService } from "./project-deliverable-gate.service.js";
import { ProjectConformanceService } from "./project-conformance.service.js";
import { ProjectBrdService } from "./project-brd.service.js";
import { ProjectUpdateService } from "./project-update.service.js";
import { ProjectComplexityService } from "./project-complexity.service.js";
import { flattenStageDeliverables, pickPrimaryStage } from "./stage-helpers.js";
import { resolveStageDeliverables } from "./stage-deliverables.util.js";
import type { ProjectDeliverableSource } from "@theforge/shared-types";
import { DocumentationGapService } from "../documentation-gap/documentation-gap.service.js";
import { PluginDocumentPipelineService } from "../../plugins/plugin-document-pipeline.service.js";
import {
  buildProjectCloneCreateInput,
  resolveCloneProjectOptions,
  type ProjectCloneSource,
} from "./project-clone.util.js";
import { ProjectGroupsService } from "../project-groups/project-groups.service.js";

import { toApiProjectListItem } from "./project-list-item.util.js";

type StageWithEst = Stage & { estimation: Estimation | null };

function toApiProject<P extends { stages: StageWithEst[] } & Record<string, unknown>>(project: P) {
  const flat = flattenStageDeliverables(project.stages, project as ProjectDeliverableSource);
  const group = project.group as { name: string } | undefined;
  const { group: _g, ...rest } = project;
  return {
    ...rest,
    ...flat,
    groupId: project.groupId as string,
    groupName: group?.name,
  };
}

@Injectable()
export class ProjectsService implements IOrchestratorProjectsPort {
  private readonly logger = new Logger(ProjectsService.name);

  /**
   * Verifica que el usuario tenga acceso al proyecto:
   * - PRIVATE: solo owner
   * - SHARED: cualquier usuario autenticado
   * Retorna el proyecto si hay acceso, o lanza NotFoundException.
   */
  private async assertProjectAccess(projectId: string): Promise<Project & { stages: StageWithEst[] }> {
    return loadAccessibleProjectWithStages(this.prisma, projectId);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly scraper: ScraperService,
    private readonly theforge: TheForgeService,
    private readonly graphMemory: GraphMemoryService,
    private readonly pluginPipeline: PluginDocumentPipelineService,
    private readonly mddPersist: ProjectMddPersistService,
    @Inject(forwardRef(() => DocumentationGapService))
    private readonly documentationGap: DocumentationGapService,
    private readonly projectGroups: ProjectGroupsService,
    @Inject(forwardRef(() => DeliverablesCascadeService))
    private readonly deliverablesCascade: DeliverablesCascadeService,
    private readonly projectStage: ProjectStageService,
    @Inject(forwardRef(() => ProjectUxGuideService))
    private readonly uxGuide: ProjectUxGuideService,
    @Inject(forwardRef(() => ProjectDeliverableGeneratorsService))
    private readonly deliverableGenerators: ProjectDeliverableGeneratorsService,
    private readonly deliverableGate: ProjectDeliverableGateService,
    private readonly projectConformance: ProjectConformanceService,
    private readonly projectBrd: ProjectBrdService,
    @Inject(forwardRef(() => ProjectUpdateService))
    private readonly projectUpdate: ProjectUpdateService,
    @Inject(forwardRef(() => ProjectComplexityService))
    private readonly projectComplexity: ProjectComplexityService,
  ) {}

  async listDocumentSnapshots(
    projectId: string,
    options?: { field?: string; limit?: number },
  ) {
    return this.projectUpdate.listDocumentSnapshots(projectId, options);
  }

  async restoreDocumentSnapshot(projectId: string, snapshotId: string) {
    return this.projectUpdate.restoreDocumentSnapshot(projectId, snapshotId);
  }

  async create(data: CreateProjectDto) {
    const parsed = createProjectSchema.parse(data);
    const isLegacy = parsed.projectType === "LEGACY";
    const userId = getRequestUserId();
    const defaultGroupId = await this.projectGroups.getDefaultGroupId();
    let groupId = defaultGroupId;
    if (parsed.groupId) {
      const targetGroup = await this.prisma.projectGroup.findUnique({
        where: { id: parsed.groupId },
        select: { id: true },
      });
      if (!targetGroup) throw new NotFoundException("Grupo no encontrado");
      groupId = parsed.groupId;
    }
    const created = await this.prisma.project.create({
      data: {
        userId,
        groupId,
        name: parsed.name,
        visibility: parsed.visibility ?? "PRIVATE",
        hasUxTeam: parsed.hasUxTeam ?? false,
        complexity: parsed.complexity as ComplexityLevel,
        projectType: parsed.projectType,
        // requireBrdTobeGate eliminado
        theforgeProjectId: parsed.theforgeProjectId ?? undefined,
        stages: {
          create: {
            ordinal: 1,
            key: "main",
            name: "Etapa principal",
            workflowStatus: StageStatus.ACTIVE,
            isLegacy,
            theforgeProjectId: parsed.theforgeProjectId ?? null,
          },
        },
      },
      include: {
        stages: { orderBy: { ordinal: "asc" }, include: { estimation: true } },
        group: { select: { name: true } },
      },
    });

    const apiProject = toApiProject(created);

    void this.pluginPipeline.runOnProjectCreate({
      projectId: created.id,
      projectName: created.name,
      userId,
      timestamp: new Date(),
    });

    if (isLegacy && parsed.theforgeProjectId?.trim()) {
      const stage = created.stages[0];
      this.theforge.scheduleAriadneBrownfieldWire(
        {
          ariadneSourceId: parsed.theforgeProjectId.trim(),
          workshopProjectId: created.id,
          workshopStageId: stage?.id ?? "",
        },
        "Projects",
      );
    }

    return apiProject;
  }

  /**
   * Deep-clones project documents and all stages into a new project owned by the current user.
   * Does not copy sessions, chat, favorites, integration links, webhooks, or suite lineage.
   */
  async cloneProject(sourceId: string, body: unknown) {
    const parsed = cloneProjectBodySchema.parse(body ?? {});
    const source = (await this.assertProjectAccess(sourceId)) as ProjectCloneSource;
    const userId = getRequestUserId();
    const options = resolveCloneProjectOptions(source, parsed);

    const created = await this.prisma.project.create({
      data: buildProjectCloneCreateInput(source, { userId, ...options }),
      include: {
        stages: { orderBy: { ordinal: "asc" }, include: { estimation: true } },
        group: { select: { name: true } },
      },
    });

    if (source.projectType === "LEGACY") {
      const sortedStages = [...created.stages].sort((a, b) => a.ordinal - b.ordinal);
      for (const stage of sortedStages) {
        const parentStage =
          stage.ordinal > 1
            ? sortedStages.find((candidate) => candidate.ordinal === stage.ordinal - 1)
            : undefined;
        this.graphMemory
          .syncLegacyStage({
            stageId: stage.id,
            projectId: created.id,
            ordinal: stage.ordinal,
            name: stage.name ?? "",
            parentStageId: parentStage?.id,
            theforgeProjectId: source.theforgeProjectId ?? undefined,
          })
          .catch(() => {});
      }
    }

    return {
      ...toApiProject(created),
      clonedFromProjectId: sourceId,
    };
  }

  async findAll() {
    const userId = getRequestUserId();
    const rows = await this.prisma.project.findMany({
      where: {
        archivedAt: null,
        OR: [
          { userId },
          { visibility: "SHARED" },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        name: true,
        visibility: true,
        complexity: true,
        complexityPending: true,
        projectType: true,
        theforgeProjectId: true,
        hasUxTeam: true,
        linkedLegacyProjectId: true,
        linkedNewProjectId: true,
        groupId: true,
        group: { select: { name: true } },
        createdAt: true,
        stages: {
          orderBy: { ordinal: "asc" },
          select: {
            id: true,
            ordinal: true,
            key: true,
            name: true,
            workflowStatus: true,
            status: true,
            precisionScore: true,
            isLegacy: true,
            estimation: true,
          },
        },
      },
    });
    const favoriteProjectIds = await this.getUserFavoriteIds(userId);
    return rows.map((p) =>
      toApiProjectListItem(p as Parameters<typeof toApiProjectListItem>[0], favoriteProjectIds.has(p.id)),
    );
  }

  async getUserFavoriteIds(userId?: string): Promise<Set<string>> {
    const uid = userId ?? getRequestUserId();
    const favs = await this.prisma.favoriteProject.findMany({
      where: { userId: uid },
      select: { projectId: true },
    });
    return new Set(favs.map((f) => f.projectId));
  }

  async toggleFavorite(projectId: string) {
    const userId = getRequestUserId();
    // Verificar acceso al proyecto (todos los proyectos visibles para el usuario)
    await this.assertProjectAccess(projectId);
    const existing = await this.prisma.favoriteProject.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (existing) {
      await this.prisma.favoriteProject.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.favoriteProject.create({
      data: { userId, projectId },
    });
    return { favorited: true };
  }

  async findOne(id: string) {
    const project = await this.assertProjectAccess(id);
    // add sessions separately (not included in assertProjectAccess)
    const withSessions = await this.prisma.project.findFirst({
      where: { id },
      include: { sessions: true },
    });
    const userId = getRequestUserId();
    const fav = await this.prisma.favoriteProject.findUnique({
      where: { userId_projectId: { userId, projectId: id } },
    });
    return {
      ...toApiProject({
        ...project,
        sessions: withSessions?.sessions ?? [],
      }),
      isFavorite: fav !== null,
    };
  }

  async update(id: string, data: UpdateProjectDto) {
    return this.projectUpdate.update(id, data);
  }

  async remove(id: string) {
    const project = await this.assertProjectAccess(id);
    const userId = getRequestUserId();
    const isOwner = project.userId === userId;
    if (!isOwner && !isAdminOrAbove(getRequestUserRole())) {
      throw new NotFoundException("Project not found");
    }
    await this.prisma.architecturalPreference.deleteMany({ where: { projectId: id } });
    try {
      await this.prisma.project.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Project not found");
    }
    return { deleted: id };
  }

  /** Una sola etapa ACTIVE por proyecto: demueve las demás ACTIVE a SUPERSEDED. */
  async activateStageExclusive(projectId: string, stageId: string): Promise<void> {
    return this.projectStage.activateStageExclusive(projectId, stageId);
  }

  async createStage(projectId: string, body: unknown) {
    return this.projectStage.createStage(projectId, body);
  }

  async listStages(projectId: string) {
    await this.assertProjectAccess(projectId);
    const stages = await this.prisma.stage.findMany({
      where: { projectId },
      orderBy: { ordinal: "asc" },
      include: { estimation: true },
    });
    return { stages };
  }

  async getStageDeliverables(projectId: string, stageId: string) {
    const project = await this.assertProjectAccess(projectId);
    const stage = project.stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException("Etapa no encontrada");
    return resolveStageDeliverables(project, stage, "workshop");
  }


  async patchStage(projectId: string, stageId: string, body: unknown) {
    return this.projectStage.patchStage(projectId, stageId, body);
  }

  async getStageDetail(projectId: string, stageId: string) {
    const project = await this.assertProjectAccess(projectId);
    const stage = project.stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException("Etapa no encontrada");

    const resolved = resolveStageDeliverables(project, stage, "workshop");
    const stageDocFields = ["mddContent", "brdContent", "changeSpecContent"] as const;
    const stageDocuments: Record<string, { exists: boolean; wordCount: number }> = {};
    for (const field of stageDocFields) {
      const text = (stage[field] ?? "") as string;
      stageDocuments[field] = {
        exists: text.trim().length > 0,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      };
    }

    const cascadeSummary: Record<string, { exists: boolean; wordCount: number }> = {};
    for (const [key, val] of Object.entries(resolved.deliverables)) {
      const text = typeof val === "string" ? val : "";
      cascadeSummary[key] = {
        exists: text.trim().length > 0,
        wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      };
    }

    return {
      stage: {
        id: stage.id,
        ordinal: stage.ordinal,
        key: stage.key,
        name: stage.name,
        workflowStatus: stage.workflowStatus,
        status: stage.status,
        precisionScore: stage.precisionScore,
        isLegacy: stage.isLegacy,
        estimation: stage.estimation,
        createdAt: stage.createdAt,
        updatedAt: stage.updatedAt,
      },
      deliverables: {
        source: resolved.source,
        readOnly: resolved.readOnly,
        snapshotCapturedAt: resolved.snapshotCapturedAt ?? null,
        stageDocuments,
        cascadeSummary,
      },
      allowedTransitions: getAllowedStageTransitions(stage.workflowStatus),
      activeStageId: pickPrimaryStage(project.stages)?.id ?? null,
    };
  }

  async transitionStage(projectId: string, stageId: string, body: unknown) {
    return this.projectStage.transitionStage(projectId, stageId, body);
  }

  async generateBenchmark(projectId: string, userIdea: string, urls?: string[]) {
    return this.projectComplexity.generateBenchmark(projectId, userIdea, urls);
  }

  async reassessComplexity(projectId: string, options?: { note?: string }) {
    return this.projectComplexity.reassessComplexity(projectId, options);
  }

  async confirmComplexityProposal(projectId: string) {
    return this.projectComplexity.confirmComplexityProposal(projectId);
  }

  tryConfirmComplexityFromChatMessage(projectId: string, message: string): Promise<{
    confirmed: boolean;
    rejected: boolean;
  }> {
    return this.projectComplexity.tryConfirmComplexityFromChatMessage(projectId, message);
  }

  /**
   * Guía UX/UI generada por LLM (mismo criterio que legacy, sin Relic).
   */
  async generateUxUiGuide(projectId: string) {
    return this.uxGuide.generateUxUiGuide(projectId);
  }

  /**
   * Design System determinista desde biblioteca (DESIGN.md importado o catálogo builtin).
   */
  async composeUxGuideFromDesignRef(projectId: string) {
    return this.uxGuide.composeUxGuideFromDesignRef(projectId);
  }

  /** Repara/regenera solo el YAML frontmatter de la Guía UX/UI. */
  async repairUxUiGuideYaml(projectId: string): Promise<string> {
    return this.uxGuide.repairUxUiGuideYaml(projectId);
  }

  async refreshStageSemaphoreFromProject(projectId: string): Promise<void> {
    return this.deliverableGate.refreshStageSemaphoreFromProject(projectId);
  }

  async assertDeliverablesAllowed(
    projectId: string,
    options?: { acknowledgeGaps?: boolean },
  ): Promise<void> {
    return this.deliverableGate.assertDeliverablesAllowed(projectId, options);
  }

  async assertMddDeliveryGateForDeliverables(projectId: string): Promise<void> {
    return this.deliverableGate.assertMddDeliveryGateForDeliverables(projectId);
  }

  async auditDocuments(projectId: string, options?: { useLlm?: boolean }) {
    return this.projectConformance.auditDocuments(projectId, options);
  }

  async getConformance(projectId: string, options?: { useLlm?: boolean }) {
    return this.projectConformance.getConformance(projectId, options);
  }

  async verifyDeliverable(
    projectId: string,
    deliverable: "blueprint" | "api" | "infra" | "logicFlows",
  ): Promise<string> {
    return this.projectConformance.verifyDeliverable(projectId, deliverable);
  }

  async suggestBrdFromDbga(
    projectId: string,
    opts?: { stageId?: string | null },
  ): Promise<{ brdContent: string; stageId: string }> {
    return this.projectBrd.suggestBrdFromDbga(projectId, opts);
  }

  async generateDocument(
    kind: DeliverableKind,
    projectId: string,
    options?: { gapsFeedback?: string | null; acknowledgeGaps?: boolean },
  ): Promise<void> {
    return this.deliverableGenerators.generateDocument(kind, projectId, options);
  }

  async generateAem(projectId: string, body: unknown) {
    return this.deliverableGenerators.generateAem(projectId, body);
  }

  async generateSpec(projectId: string) {
    return this.deliverableGenerators.generateSpec(projectId);
  }

  async clearAgentGovernanceContent(projectId: string) {
    return this.deliverableGenerators.clearAgentGovernanceContent(projectId);
  }

  async generateAgentGovernance(
    projectId: string,
    target?: string,
    options?: { forceRegenerate?: boolean; skipSddAutoReconcile?: boolean },
  ) {
    return this.deliverableGenerators.generateAgentGovernance(projectId, target, options);
  }

  async generateAgentGovernancePreview(
    projectId: string,
    target?: string,
    options?: { forceRegenerate?: boolean },
  ): Promise<{ content: string }> {
    return this.deliverableGenerators.generateAgentGovernancePreview(projectId, target, options);
  }

  async getAgentGovernanceForExport(projectId: string) {
    return this.deliverableGenerators.getAgentGovernanceForExport(projectId);
  }

  async generateTasks(
    projectId: string,
    gapsFeedback?: string | null,
    options?: { acknowledgeGaps?: boolean },
  ) {
    return this.deliverableGenerators.generateTasks(projectId, gapsFeedback, options);
  }

  async generateArchitecturePreview(projectId: string): Promise<{ content: string }> {
    return this.deliverableGenerators.generateArchitecturePreview(projectId);
  }

  async generateArchitecture(projectId: string, gapsFeedback?: string | null) {
    return this.deliverableGenerators.generateArchitecture(projectId, gapsFeedback);
  }

  async generateUseCasesPreview(projectId: string): Promise<{ content: string }> {
    return this.deliverableGenerators.generateUseCasesPreview(projectId);
  }

  async generateUseCases(projectId: string) {
    return this.deliverableGenerators.generateUseCases(projectId);
  }

  async generateUserStoriesPreview(projectId: string): Promise<{ content: string }> {
    return this.deliverableGenerators.generateUserStoriesPreview(projectId);
  }

  async generateUserStories(projectId: string) {
    return this.deliverableGenerators.generateUserStories(projectId);
  }

  async generateBlueprintPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    return this.deliverableGenerators.generateBlueprintPreview(projectId, gapsFeedback);
  }

  async generateBlueprint(projectId: string, gapsFeedback?: string | null) {
    return this.deliverableGenerators.generateBlueprint(projectId, gapsFeedback);
  }

  async generateApiContractsPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    return this.deliverableGenerators.generateApiContractsPreview(projectId, gapsFeedback);
  }

  async generateInfraPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    return this.deliverableGenerators.generateInfraPreview(projectId, gapsFeedback);
  }

  async generateApiContracts(projectId: string, gapsFeedback?: string | null) {
    return this.deliverableGenerators.generateApiContracts(projectId, gapsFeedback);
  }

  async generateLogicFlows(projectId: string, gapsFeedback?: string | null) {
    return this.deliverableGenerators.generateLogicFlows(projectId, gapsFeedback);
  }

  async patchMddFromGapFeedback(
    projectId: string,
    stageId: string,
    gapsFeedback: string,
  ): Promise<void> {
    return this.deliverableGenerators.patchMddFromGapFeedback(projectId, stageId, gapsFeedback);
  }

  async generateInfra(projectId: string, gapsFeedback?: string | null) {
    return this.deliverableGenerators.generateInfra(projectId, gapsFeedback);
  }

  /**
   * Orquestación multi-ola de entregables.
   * @param onProgress — opcional (p. ej. BullMQ `job.updateProgress`).
   */
  async generateDeliverablesCascade(
    projectId: string,
    onProgress?: (p: {
      step: string;
      completedSteps: string[];
      index: number;
      total: number;
    }) => void,
    options?: { acknowledgeGaps?: boolean },
  ) {
    return this.deliverablesCascade.generateDeliverablesCascade(projectId, onProgress, options);
  }

  /** Tras cascada o regeneración individual: detecta conflictos SDD y los expone como gaps HITL. */
  async runPostRegenSddConflictSurfacing(projectId: string): Promise<void> {
    const project = await this.findOne(projectId);
    const activeStage = pickPrimaryStage(project.stages ?? []);
    if (!activeStage?.id) return;
    const summary = await this.documentationGap.detectAndSurfaceSddConflicts(
      projectId,
      activeStage.id,
    );
    if (summary.conflictsDetected > 0) {
      this.logger.debug(
        `[SDD surfacing] projectId=${projectId} conflicts=${summary.conflictsDetected} created=${summary.gapsCreated} duplicates=${summary.duplicates}`,
      );
    }
  }

  /** @deprecated Usar `runPostRegenSddConflictSurfacing`. Solo reconciliación explícita vía approve gap. */
  async runPostRegenSddAutoReconcile(projectId: string): Promise<void> {
    const project = await this.findOne(projectId);
    const activeStage = pickPrimaryStage(project.stages ?? []);
    if (!activeStage?.id) return;
    const summary = await this.documentationGap.autoReconcileSddConflicts(projectId, activeStage.id);
    if (!summary.clean && summary.remainingConflicts.length > 0) {
      this.logger.warn(
        `[SDD auto-reconcile] projectId=${projectId} retries=${summary.retries} remaining=${summary.remainingConflicts.length}`,
      );
    } else if (summary.deterministicPasses > 0 || summary.reconcilePasses > 0) {
      this.logger.debug(
        `[SDD auto-reconcile] projectId=${projectId} deterministic=${summary.deterministicPasses} reconcile=${summary.reconcilePasses}`,
      );
    }
  }

  async phase0DeepResearch(
    projectId: string,
    options: { userIdea?: string; urls?: string[]; includeBenchmark?: boolean },
  ) {
    const project = await this.assertProjectAccess(projectId);
    if ((project as { projectType?: string }).projectType === "LEGACY") {
      throw new BadRequestException(
        "Paso 0 (Deep Research) no aplica a proyectos legacy. Usa el flujo de modificaciones en el chat.",
      );
    }
    const userIdea = options.userIdea?.trim() ?? "";
    const resolvedUrls = resolveUrls(options.urls, userIdea);
    let scrapedContext: string | undefined;
    if (resolvedUrls.length > 0) {
      const pages = await this.scraper.scrapeUrls(resolvedUrls);
      scrapedContext = pages
        .filter((p) => p.markdown.trim().length > 0)
        .map((p) => `## Referencia: ${p.url}\n\n${p.markdown}`)
        .join("\n\n");
    }
    const dbgaContent =
      options.includeBenchmark && project.dbgaContent?.trim() ? project.dbgaContent : undefined;
    let summary: string;
    try {
      summary = await this.discovery.generatePhase0DeepResearch(
        userIdea,
        scrapedContext,
        dbgaContent,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error en Deep Research";
      throw new Error(
        `Falló la generación del resumen (Deep Research). ${message.slice(0, 200)}`,
      );
    }
    if (typeof summary !== "string") {
      throw new Error("El proveedor de IA devolvió un formato inesperado");
    }
    return this.update(projectId, {
      phase0SummaryContent: cleanDocumentContent(summary.trim()),
    });
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
    return this.mddPersist.persistMddFromBackgroundJob(projectId, rawMarkdown, options);
  }
}
