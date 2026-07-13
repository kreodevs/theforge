import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, forwardRef } from "@nestjs/common";
import { ComplexityLevel, Prisma, StageStatus, Status } from "@theforge/database";
import type { Estimation, Project, Stage } from "@theforge/database";
import { getRequestUserId, getRequestUserRole } from "../../common/request-user.store.js";
import { isAdminOrAbove } from "../../common/roles.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { cleanDocumentContent } from "../sessions/document-content.util.js";
import { validateDocumentForPersist } from "../sessions/document-shrink.util.js";
import { enrichBlueprintWithUiDesignSystem } from "../engine/blueprint-enrich-ui-system.js";
import {
  buildBlueprintQualityRetryFeedback,
  collectBlueprintQualityGaps,
  repairBlueprintProgrammaticGaps,
  runBlueprintQualityChecks,
} from "../engine/blueprint-conformance-repair.util.js";
import {
  buildApiRetryFeedback,
  repairApiProgrammaticGaps,
  runApiConformanceCheck,
} from "../engine/api-conformance-repair.util.js";
import { UiMcpClientService } from "../ui-mcp/ui-mcp-client.service.js";
import { UiMcpService } from "../ui-mcp/ui-mcp.service.js";
import {
  McpUiComponentResolver,
  heuristicUiComponentResolver,
  type UiComponentResolver,
} from "../ui-mcp/ui-component-resolver.js";
import {
  UI_MCP_DESIGN_SYSTEM_HEADING,
  buildUiMcpDesignSystemSection,
} from "../ui-mcp/ui-design-system-section.util.js";
import { MddUpdatePipelineService } from "../engine/mdd-update-pipeline.service.js";
import { SemaphoreService, type SemaphoreEvaluationInput } from "../engine/semaphore.service.js";
import { normalizeMddContent } from "../engine/mdd-markdown-parser.js";
import { shouldReplacePhase0SummaryWithBorrador, generateAemBodySchema, isPhase0BorradorJson, isBrownfieldCapable } from "@theforge/shared-types";
import { prepareMddMarkdownForPersist } from "../ai-analysis/utils/mdd-sanitize.js";
import {
  enforceMddGovernancePatternsOnPersist,
  mddHasSubstantialBody,
} from "@theforge/shared-types/mdd-governance-patterns";
import { loadProjectBorrador, hasBorradorContent } from "../ai-analysis/phase0/phase0-load-borrador.util.js";
import { phase0ToMarkdown } from "../ai-analysis/phase0/phase0-to-markdown.js";
import { ProjectEstimationRecalcService } from "./project-estimation-recalc.service.js";
import type { ApiConformanceResult, ConformanceResult } from "../engine/conformance.service.js";
import {
  ConformanceService,
  checkBlueprintDataModelVsMdd,
  checkBlueprintSectionHeaders,
  checkBlueprintSelfContained,
  checkApiVsMdd,
  checkLogicFlowsVsMdd,
  checkInfraVsMdd,
  extractEntities,
  extractMddSection4Endpoints,
  extractSection,
} from "../engine/conformance.service.js";
import { AiService } from "../ai/ai.service.js";
import { DiscoveryService } from "../ai/discovery.service.js";
import { ScraperService } from "../scraper/scraper.service.js";
import { TheForgeService } from "../theforge/theforge.service.js";
import { GraphMemoryService } from "../ai-analysis/graph-memory/graph-memory.service.js";
import { ChangeLogService } from "../change-log/change-log.service.js";
import type { LegacyGenerateOptions } from "../ai/ai.service.js";
import {
  extractSection5Services,
  readLogicFlowsBatchSize,
  scoreLogicFlowsSection5Coverage,
  toLogicFlowsSection5CoverageReport,
} from "../ai/utils/legacy-as-is-logic-flows.util.js";
import { buildLegacyGenerateOptions } from "../legacy-flow/legacy-generate-options.util.js";
import { ProjectIntegrationService } from "./integration/project-integration.service.js";
import { buildHandoffUserStoriesAppendix } from "./integration/integration-context.util.js";
import { patchLegacyDeliverablesDebugReport } from "../legacy-flow/legacy-flow-state-debug.util.js";
import type { IOrchestratorProjectsPort } from "./projects-service.port.js";
import { resolveUrls } from "../scraper/url-utils.js";
import {
  createProjectSchema,
  createStageBodySchema,
  cloneProjectBodySchema,
  patchStageBodySchema,
  updateProjectSchema,
  DELIVERABLE_WAVES_BY_COMPLEXITY,
  flattenDeliverableWaves,
  parseAgentGovernanceScaffold,
  type DeliverableKind,
  type DeliverableWaveStep,
  type ComplexityPending,
  type CreateProjectDto,
  type UpdateProjectDto,
  specKitFeatureDir,
} from "@theforge/shared-types";
import {
  parseAgentGovernanceResponse,
  serializeAgentGovernanceScaffold,
} from "../ai/utils/agent-governance.util.js";
import {
  suggestAgentGovernanceArtifacts,
} from "../ai/utils/suggest-agent-governance-artifacts.js";
import { UX_UI_GUIDE_PROMPT } from "../ai/prompts/ux-ui-guide-prompt.js";
import { uxGuideLlmOptions } from "../ai/ux-guide-llm-context.js";
import { buildMddContextForUxGuide } from "../ai/utils/mdd-ux-guide-brief.util.js";
import { appendUxGuideDesignAttribution } from "../design-ref/design-ref-attribution.util.js";
import {
  composeDesignSystemFromRef,
  composeDesignSystemFromScannedTokens,
} from "../design-ref/compose-design-system-from-ref.util.js";
import {
  lintDesignMd,
  formatLintSummary,
  type DesignMdLintResult,
} from "../design-ref/design-md-lint.util.js";
import { scanUrlForDesignTokens } from "../design-ref/scan-url.util.js";
import {
  brdGenerationErrorMessage,
  extractBrdFromLlmResponse,
  type BrdExtractFailure,
} from "../ai/utils/brd-extract.util.js";
import { validateBrdMermaidOutput } from "../ai/utils/brd-mermaid-validate.util.js";
import { truncateSourceDocForBrdPrompt } from "../ai/utils/dbga-prompt-context.util.js";

import { flattenStageDeliverables, pickPrimaryStage } from "./stage-helpers.js";
import { resolveStageDeliverables } from "./stage-deliverables.util.js";
import { persistStageDeliverableSnapshotFromProject, ensureStageDeliverableSnapshotIfMissing } from "./stage-deliverable-snapshot.util.js";
import {
  buildMddDeliveryGateConflictBody,
  evaluateMddDeliveryGatePrepared,
  MDD_DELIVERY_GATE_ERR,
} from "../ai-analysis/utils/mdd-delivery-gate-guard.util.js";
import {
  mergeDeliveryGateIntoShortTermContext,
} from "../ai-analysis/utils/mdd-delivery-gate.util.js";
import type { MddDeliveryGateResult } from "@theforge/shared-types";
import {
  persistStageAndProjectDeliverables,
  seedActiveStageDeliverables,
} from "./stage-deliverable-persist.util.js";
import { pickDeliverableFieldsFromSource, type ProjectDeliverableSource } from "@theforge/shared-types";
import { SddIntegrationService } from "./sdd-integration.service.js";
import { reconcileExportScaffold, buildUnifiedHandoff, buildAgentGovernanceInput, synthesizeExportGovernanceScaffold } from "./handoff-export.util.js";
import { EvdVisualStylistService } from "../evd/evd-visual-stylist.service.js";
import { DocumentationGapService } from "../documentation-gap/documentation-gap.service.js";
import { UiScreensService } from "../ui-mcp/ui-screens.service.js";
import {
  collectSddPrecisionGaps,
  formatPrecisionGapsFeedback,
  precisionGapsForPostPassRetry,
} from "../engine/sdd-precision-checks.util.js";
import {
  buildTasksCoordinatesPromptBlock,
  extractMddCapabilityLines,
  parseChangeScopeFromLegacyState,
} from "./tasks-coordinates-context.util.js";
import { ResolveChangeToFilesService } from "../legacy-flow/resolve-change-to-files.service.js";
import { PlanValidationService } from "./plan-validation.service.js";
import { loadConsumptionGuideMarkdown } from "./consumption-guide.util.js";
import {
  buildProjectCloneCreateInput,
  resolveCloneProjectOptions,
  type ProjectCloneSource,
} from "./project-clone.util.js";
import { toApiProjectListItem } from "./project-list-item.util.js";

import {
  BRD_GENERATION_SYSTEM,
  buildBrdGenerationRetryReminder,
  buildBrdUserPrompt,
} from "../ai/prompts/brd-generation-prompt.js";

type StageWithEst = Stage & { estimation: Estimation | null };

function toApiProject<P extends { stages: StageWithEst[] } & Record<string, unknown>>(project: P) {
  const flat = flattenStageDeliverables(project.stages, project as ProjectDeliverableSource);
  return { ...project, ...flat };
}

@Injectable()
export class ProjectsService implements IOrchestratorProjectsPort {
  private readonly logger = new Logger(ProjectsService.name);

  /** Scope de proyecto autenticado (AsyncLocalStorage). Solo owner. */
  private projectWhereForUser(projectId: string) {
    return { id: projectId, userId: getRequestUserId() };
  }

  /**
   * Verifica que el usuario tenga acceso al proyecto:
   * - PRIVATE: solo owner
   * - SHARED: cualquier usuario autenticado
   * Retorna el proyecto si hay acceso, o lanza NotFoundException.
   */
  private async assertProjectAccess(projectId: string): Promise<Project & { stages: StageWithEst[] }> {
    const userId = getRequestUserId();
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      include: { stages: { orderBy: { ordinal: "asc" }, include: { estimation: true } } },
    });
    if (!project) throw new NotFoundException("Project not found");
    const isOwner = project.userId === userId;
    const isShared = project.visibility === "SHARED";
    if (!isOwner && !isShared) throw new NotFoundException("Project not found");
    return project as Project & { stages: StageWithEst[] };
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly conformance: ConformanceService,
    private readonly ai: AiService,
    private readonly discovery: DiscoveryService,
    private readonly scraper: ScraperService,
    private readonly estimationRecalc: ProjectEstimationRecalcService,
    private readonly mddUpdatePipeline: MddUpdatePipelineService,
    private readonly semaphore: SemaphoreService,
    private readonly theforge: TheForgeService,
    private readonly graphMemory: GraphMemoryService,
    private readonly changeLog: ChangeLogService,
    private readonly projectIntegration: ProjectIntegrationService,
    private readonly sddIntegration: SddIntegrationService,
    private readonly uiMcpClient: UiMcpClientService,
    private readonly uiMcp: UiMcpService,
    @Inject(forwardRef(() => DocumentationGapService))
    private readonly documentationGap: DocumentationGapService,
    private readonly uiScreens: UiScreensService,
    @Inject(forwardRef(() => ResolveChangeToFilesService))
    private readonly resolveChangeToFiles: ResolveChangeToFilesService,
    private readonly planValidation: PlanValidationService,
    private readonly visualStylist: EvdVisualStylistService,
  ) {}

  /** Opciones greenfield: Phase0 + blueprint para checklist de cobertura. */
  private greenfieldGenerateOptions(project: Project): LegacyGenerateOptions {
    return {
      phase0SummaryContent: project.phase0SummaryContent,
      phase0GapsJson: project.phase0Gaps,
      coverageBlueprintContent: project.blueprintContent,
    };
  }

  /**
   * Anexa la sección de design system inferida del MCP gráfico compatible activo, si lo hay.
   * Fallback: si no hay MCP activo o falla, devuelve el contenido sin cambios (design system del LLM/Ariadne).
   */
  private async appendUiMcpDesignSystem(content: string): Promise<string> {
    try {
      if (!(await this.uiMcpClient.isActive())) return content;
      if (content.includes(UI_MCP_DESIGN_SYSTEM_HEADING)) return content;
      const [tokens, meta, components] = await Promise.all([
        this.uiMcpClient.getDesignTokens(),
        this.uiMcp.getActiveCompatibleMeta(),
        this.uiMcpClient.listComponents(),
      ]);
      const section = buildUiMcpDesignSystemSection({
        tokens,
        components,
        libraryName: meta?.libraryName,
        libraryVersion: meta?.libraryVersion,
      });
      if (!section) return content;
      return `${content.trimEnd()}\n\n${section}`;
    } catch {
      return content;
    }
  }

  /** Resolver de componentes UI: MCP compatible activo o heurístico (fallback por-entidad). */
  private async getUiResolver(): Promise<UiComponentResolver> {
    try {
      if (await this.uiMcpClient.isActive()) {
        return new McpUiComponentResolver(this.uiMcpClient);
      }
    } catch {
      /* fallback heurístico */
    }
    return heuristicUiComponentResolver;
  }

  private buildSemaphoreBase(
    p: Pick<
      Project,
      | "complexity"
      | "hasUxTeam"
      | "figmaMapping"
      | "specContent"
      | "useCasesContent"
      | "userStoriesContent"
      | "tasksContent"
      | "apiContractsContent"
      | "uxUiGuideContent"
      | "logicFlowsContent"
      | "infraContent"
    >,
  ): Omit<SemaphoreEvaluationInput, "mddJsonString"> {
    return {
      complexity: p.complexity ?? ComplexityLevel.HIGH,
      hasUxTeam: p.hasUxTeam,
      figmaMapping: p.figmaMapping,
      deliverables: {
        specContent: p.specContent,
        useCasesContent: p.useCasesContent,
        userStoriesContent: p.userStoriesContent,
        tasksContent: p.tasksContent,
        apiContractsContent: p.apiContractsContent,
        uxUiGuideContent: p.uxUiGuideContent,
        logicFlowsContent: p.logicFlowsContent,
        infraContent: p.infraContent,
      },
    };
  }

  private mergeProjectForSemaphore(
    existing: Project,
    rest: Partial<UpdateProjectDto>,
  ): Pick<
    Project,
    | "complexity"
    | "hasUxTeam"
    | "figmaMapping"
    | "specContent"
    | "useCasesContent"
    | "userStoriesContent"
    | "tasksContent"
    | "apiContractsContent"
    | "uxUiGuideContent"
    | "logicFlowsContent"
    | "infraContent"
  > {
    return {
      complexity: (rest.complexity ?? existing.complexity) as ComplexityLevel,
      hasUxTeam: rest.hasUxTeam ?? existing.hasUxTeam,
      figmaMapping: (rest.figmaMapping !== undefined ? rest.figmaMapping : existing.figmaMapping) as Project["figmaMapping"],
      specContent: rest.specContent !== undefined ? rest.specContent : existing.specContent,
      useCasesContent: rest.useCasesContent !== undefined ? rest.useCasesContent : existing.useCasesContent,
      userStoriesContent: rest.userStoriesContent !== undefined ? rest.userStoriesContent : existing.userStoriesContent,
      tasksContent: rest.tasksContent !== undefined ? rest.tasksContent : existing.tasksContent,
      apiContractsContent: rest.apiContractsContent !== undefined ? rest.apiContractsContent : existing.apiContractsContent,
      uxUiGuideContent: rest.uxUiGuideContent !== undefined ? rest.uxUiGuideContent : existing.uxUiGuideContent,
      logicFlowsContent: rest.logicFlowsContent !== undefined ? rest.logicFlowsContent : existing.logicFlowsContent,
      infraContent: rest.infraContent !== undefined ? rest.infraContent : existing.infraContent,
    };
  }

  private mddJsonStringForSemaphore(mddContent: string | null): string | null {
    if (!mddContent?.trim()) return null;
    const normalized = normalizeMddContent(mddContent);
    return JSON.stringify(normalized);
  }

  private countSddPrecisionGaps(
    project: Pick<
      Project,
      | "architectureContent"
      | "blueprintContent"
      | "tasksContent"
      | "logicFlowsContent"
      | "userStoriesContent"
      | "useCasesContent"
      | "apiContractsContent"
      | "uiScreensContent"
      | "phase0SummaryContent"
    >,
    mddMarkdown: string | null | undefined,
  ): number {
    const mdd = (mddMarkdown ?? "").trim();
    if (mdd.length < 120) return 0;
    return collectSddPrecisionGaps({
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
    }).length;
  }

  /** Recalcula semáforo de la etapa principal cuando cambian entregables/complejidad sin tocar el MDD. */
  private async refreshStageSemaphoreFromProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      include: { stages: { orderBy: { ordinal: "asc" }, include: { estimation: true } } },
    });
    if (!project) return;
    const targetStage = pickPrimaryStage(project.stages);
    if (!targetStage) return;

    const mddMarkdown = targetStage.mddContent ?? "";
    const sddCrossArtifactGapCount = this.countSddPrecisionGaps(project, mddMarkdown);

    const { status, precisionScore } = this.semaphore.evaluate({
      ...this.buildSemaphoreBase(project),
      mddJsonString: this.mddJsonStringForSemaphore(mddMarkdown),
      sddCrossArtifactGapCount,
    });

    await this.prisma.stage.update({
      where: { id: targetStage.id },
      data: { status, precisionScore },
    });

    const mddForRecalc = targetStage.mddContent ?? null;
    if (mddForRecalc != null) {
      await this.estimationRecalc.recalcAndUpsert(targetStage.id, {
        mddContent: mddForRecalc,
        infraContent: project.infraContent ?? null,
        status,
      });
    }
  }

  private mddFromStages(stages: StageWithEst[]): string {
    return pickPrimaryStage(stages)?.mddContent ?? "";
  }

  /** Insumo principal para prompts de entregables: MDD o, en LOW/MEDIUM sin MDD, DBGA + resumen + spec. */
  private constitutionMarkdown(project: Project & { stages: StageWithEst[] }): string {
    const mdd = this.mddFromStages(project.stages).trim();
    if (mdd.length > 0) return mdd;
    const cx = project.complexity ?? ComplexityLevel.HIGH;
    if (cx === ComplexityLevel.LOW || cx === ComplexityLevel.MEDIUM) {
      const parts = [
        (project.dbgaContent ?? "").trim(),
        (project.phase0SummaryContent ?? "").trim(),
        (project.specContent ?? "").trim(),
      ].filter((p) => p.length > 0);
      return parts.join("\n\n---\n\n");
    }
    return "";
  }

  /** Bloquea generación de entregables si el MDD no aprueba el gate (409 + ERR_MDD_DELIVERY_GATE). */
  async assertDeliverablesAllowed(
    projectId: string,
    options?: { acknowledgeGaps?: boolean },
  ): Promise<void> {
    const project = await this.assertProjectAccess(projectId);
    if (project.projectType === "LEGACY") return;
    await this.assertDeliverablesMddGate(project, options?.acknowledgeGaps === true);
  }

  /** Gate MDD de entrega para cualquier tipo de proyecto (incl. LEGACY). */
  async assertMddDeliveryGateForDeliverables(projectId: string): Promise<void> {
    const project = await this.assertProjectAccess(projectId);
    await this.assertDeliverablesMddGate(project);
  }

  private async assertDeliverablesMddGate(
    project: Project & { stages: StageWithEst[] },
    acknowledgeGaps = false,
  ): Promise<void> {
    const stage = pickPrimaryStage(project.stages);
    const mdd = this.mddFromStages(project.stages).trim();
    const cx = project.complexity ?? ComplexityLevel.HIGH;

    if (!mdd) {
      if (cx !== ComplexityLevel.HIGH) return;
      const gate: MddDeliveryGateResult = {
        ok: false,
        score: 0,
        blockers: [
          "No hay MDD en la etapa activa; completa la Constitución antes de generar entregables.",
        ],
        warnings: [],
      };
      if (stage?.id) void this.persistMddDeliveryGateSnapshot(stage.id, gate);
      if (!acknowledgeGaps) {
        throw new ConflictException(
          buildMddDeliveryGateConflictBody(gate, gate.blockers[0]!),
        );
      }
      return;
    }

    const gate = await evaluateMddDeliveryGatePrepared(mdd);
    if (stage?.id) void this.persistMddDeliveryGateSnapshot(stage.id, gate);
    if (!gate.ok && !acknowledgeGaps) {
      throw new ConflictException(buildMddDeliveryGateConflictBody(gate));
    }
  }

  private async persistMddDeliveryGateSnapshot(
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

  async create(data: CreateProjectDto) {
    const parsed = createProjectSchema.parse(data);
    const isLegacy = parsed.projectType === "LEGACY";
    const userId = getRequestUserId();
    const created = await this.prisma.project.create({
      data: {
        userId,
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
      },
    });

    const apiProject = toApiProject(created);

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
    const parsed = updateProjectSchema.partial().parse(data);
    const existing = await this.assertProjectAccess(id);
    const existingRaw = existing as Project & { stages: StageWithEst[] };

    const {
      mddContent: parsedMdd,
      stageId: parsedStageId,
      allowGovernancePatternChange,
      clearMddCompletely,
      mddGovernanceSeedOnly,
      mddFormatOnly,
      clearComplexityPending,
      complexityPending: cpInput,
      ...rest
    } = parsed;

    // Settings que solo el owner puede cambiar
    const hasSettingsChange = rest.name !== undefined || rest.visibility !== undefined ||
      rest.complexity !== undefined || rest.hasUxTeam !== undefined ||
      rest.projectType !== undefined || rest.theforgeProjectId !== undefined ||
      rest.figmaMapping !== undefined || clearComplexityPending === true ||
      cpInput !== undefined ||
      rest.convergeWebhookUrl !== undefined || rest.convergeWebhookSecret !== undefined;
    if (hasSettingsChange && existingRaw.userId !== getRequestUserId()) {
      throw new BadRequestException("Only the project owner can change project settings");
    }

    const targetStage: StageWithEst | undefined =
      (parsedStageId?.trim() && existingRaw.stages.find((s) => s.id === parsedStageId.trim())) ||
      pickPrimaryStage(existingRaw.stages);
    if (!targetStage) throw new BadRequestException("El proyecto no tiene etapas");

    if (rest.specContent !== undefined) {
      const specValidation = validateDocumentForPersist(existingRaw.specContent, rest.specContent, {
        fieldLabel: "Spec",
      });
      if (!specValidation.ok) {
        throw new BadRequestException(specValidation.message);
      }
    }

    let mddGovernancePatternsReverted = false;
    let mddForPipeline: string | null | undefined = parsedMdd;
    if (parsedMdd !== undefined && parsedMdd !== null) {
      const enforced = enforceMddGovernancePatternsOnPersist(
        parsedMdd,
        targetStage.mddContent,
        {
          allowPatternChange: allowGovernancePatternChange === true,
          clearMddCompletely: clearMddCompletely === true,
        },
      );
      mddForPipeline = enforced.markdown;
      mddGovernancePatternsReverted = enforced.patternsReverted;
    }

    const mergedForSemaphore = this.mergeProjectForSemaphore(existingRaw, rest);

    const updatePayload: Prisma.ProjectUpdateInput = {
      ...rest,
      figmaMapping:
        rest.figmaMapping === null ? undefined : (rest.figmaMapping as Prisma.InputJsonValue),
    };
    if (clearComplexityPending === true) {
      updatePayload.complexityPending = Prisma.JsonNull;
    } else if (cpInput !== undefined) {
      updatePayload.complexityPending =
        cpInput === null ? Prisma.JsonNull : (cpInput as Prisma.InputJsonValue);
    }
    if (rest.uxUiGuideContent !== undefined) {
      updatePayload.uxUiGuideContent = rest.uxUiGuideContent;
    }
    if (rest.dbgaContent !== undefined && rest.dbgaContent !== null) {
      const { ensureJsonCodeFences } = await import("../ai-analysis/state/state-to-markdown.js");
      updatePayload.dbgaContent = ensureJsonCodeFences(rest.dbgaContent);
      const { isPhase0StructuredMarkdown, markdownToPhase0Document } = await import(
        "../ai-analysis/phase0/phase0-from-markdown.js"
      );
      if (isPhase0StructuredMarkdown(rest.dbgaContent)) {
        if (shouldReplacePhase0SummaryWithBorrador(existing.phase0SummaryContent)) {
          updatePayload.phase0SummaryContent = JSON.stringify(
            markdownToPhase0Document(rest.dbgaContent),
            null,
            2,
          );
        }
      }
    }

    const infraContentForRecalc = rest.infraContent ?? existing.infraContent ?? null;

    let pipelineResult: { sanitizedMdd: string; status: Status; precisionScore: number } | null = null;
    if (mddForPipeline !== undefined && mddForPipeline !== null) {
      const skipPipelineForSeed =
        clearMddCompletely === true ||
        (mddGovernanceSeedOnly === true && !mddHasSubstantialBody(mddForPipeline));
      if (mddFormatOnly === true) {
        const formatted = prepareMddMarkdownForPersist(mddForPipeline ?? "");
        await this.prisma.stage.update({
          where: { id: targetStage.id },
          data: { mddContent: formatted },
        });
        await this.changeLog.log(id, "mddContent", formatted);
        pipelineResult = {
          sanitizedMdd: formatted,
          status: targetStage.status,
          precisionScore: targetStage.precisionScore,
        };
      } else if (skipPipelineForSeed) {
        await this.prisma.stage.update({
          where: { id: targetStage.id },
          data: { mddContent: mddForPipeline },
        });
        await this.changeLog.log(id, "mddContent", mddForPipeline);
        pipelineResult = {
          sanitizedMdd: mddForPipeline,
          status: targetStage.status,
          precisionScore: targetStage.precisionScore,
        };
      } else {
        const result = await this.mddUpdatePipeline.process(
          mddForPipeline,
          this.buildSemaphoreBase(mergedForSemaphore),
          { projectId: id, stageId: targetStage.id },
        );
        if (!result.ok) {
          if (result.code === MDD_DELIVERY_GATE_ERR && targetStage.id) {
            const gate = await evaluateMddDeliveryGatePrepared(mddForPipeline);
            void this.persistMddDeliveryGateSnapshot(targetStage.id, gate);
          }
          throw new BadRequestException({
            code: result.code,
            message: result.message,
          });
        }
        pipelineResult = {
          sanitizedMdd: result.sanitizedMdd,
          status: result.status,
          precisionScore: result.precisionScore,
        };
        await this.prisma.stage.update({
          where: { id: targetStage.id },
          data: {
            mddContent: result.sanitizedMdd,
            status: result.status,
            precisionScore: result.precisionScore,
          },
        });
        await this.changeLog.log(id, "mddContent", result.sanitizedMdd);
        void this.persistMddDeliveryGateSnapshot(
          targetStage.id,
          await evaluateMddDeliveryGatePrepared(result.sanitizedMdd),
        );
      }
    }

    const mddForRecalc =
      pipelineResult?.sanitizedMdd ?? targetStage.mddContent ?? null;
    const statusForRecalc = pipelineResult?.status ?? targetStage.status;

    if (mddForRecalc != null && (mddForPipeline !== undefined || rest.infraContent !== undefined)) {
      await this.estimationRecalc.recalcAndUpsert(targetStage.id, {
        mddContent: mddForRecalc,
        infraContent: infraContentForRecalc,
        status: statusForRecalc,
      });
    }

    const hasProjectFieldUpdates =
      (Object.keys(rest) as (keyof typeof rest)[]).some((k) => rest[k] !== undefined) ||
      clearComplexityPending === true ||
      cpInput !== undefined;
    if (hasProjectFieldUpdates) {
      const deliverablePatch = pickDeliverableFieldsFromSource(rest as ProjectDeliverableSource);
      const hasDeliverablePatch = Object.keys(deliverablePatch).length > 0;

      await this.prisma.project.update({
        where: { id },
        data: updatePayload,
      });

      if (hasDeliverablePatch) {
        await persistStageAndProjectDeliverables(this.prisma, targetStage.id, id, deliverablePatch);
      }
      // Bitácora de cambios para campos de contenido documental
      const documentFields = [
        "dbgaContent", "specContent", "architectureContent", "useCasesContent",
        "userStoriesContent", "blueprintContent", "tasksContent",
        "apiContractsContent", "logicFlowsContent", "infraContent",
        "agentGovernanceContent",
        "uxUiGuideContent", "phase0SummaryContent", "aemContent",
        "handoffSpecContent", "evdContent",
      ] as const;
      for (const field of documentFields) {
        if ((rest as Record<string, unknown>)[field] !== undefined) {
          await this.changeLog.log(id, field, (rest as Record<string, string | null | undefined>)[field]);
        }
      }
    }

    const shouldRefreshSemaphoreWithoutMdd =
      (mddForPipeline === undefined || mddForPipeline === null) &&
      (rest.complexity !== undefined ||
        rest.hasUxTeam !== undefined ||
        rest.figmaMapping !== undefined ||
        rest.specContent !== undefined ||
        rest.useCasesContent !== undefined ||
        rest.userStoriesContent !== undefined ||
        rest.tasksContent !== undefined ||
        rest.apiContractsContent !== undefined ||
        rest.uxUiGuideContent !== undefined ||
        rest.logicFlowsContent !== undefined ||
        cpInput !== undefined ||
        clearComplexityPending === true);
    if (shouldRefreshSemaphoreWithoutMdd) {
      await this.refreshStageSemaphoreFromProject(id);
    }

    const project = await this.findOne(id);
    if (mddGovernancePatternsReverted) {
      return { ...project, mddGovernancePatternsReverted: true as const };
    }
    return project;
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
    const uid = getRequestUserId();
    const stage = await this.prisma.stage.findFirst({
      where: {
        id: stageId,
        projectId,
        project: { id: projectId, userId: uid },
      },
    });
    if (!stage) throw new NotFoundException("Etapa no encontrada");

    const previousActive = await this.prisma.stage.findMany({
      where: { projectId, workflowStatus: StageStatus.ACTIVE, NOT: { id: stageId } },
      select: { id: true, ordinal: true, deliverableSnapshot: true },
    });

    for (const prev of previousActive) {
      if (prev.ordinal >= 1) {
        await ensureStageDeliverableSnapshotIfMissing(this.prisma, prev.id, projectId, {
          source: "cascade",
        }).catch((err) =>
          this.logger.warn(
            `[Stage] snapshot before activate: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.stage.updateMany({
        where: { projectId, workflowStatus: StageStatus.ACTIVE },
        data: { workflowStatus: StageStatus.SUPERSEDED },
      }),
      this.prisma.stage.update({
        where: { id: stageId },
        data: { workflowStatus: StageStatus.ACTIVE },
      }),
    ]);

    const previousStageId = previousActive.sort((a, b) => a.ordinal - b.ordinal)[0]?.id;
    await seedActiveStageDeliverables(this.prisma, stageId, projectId, {
      previousStageId: previousStageId ?? null,
    }).catch((err) =>
      this.logger.warn(
        `[Stage] seed deliverables on activate: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  async createStage(projectId: string, body: unknown) {
    const dto = createStageBodySchema.parse(body);
    const project = await this.prisma.project.findFirst({
      where: this.projectWhereForUser(projectId),
      include: { stages: { orderBy: { ordinal: "asc" } } },
    });
    if (!project) throw new NotFoundException("Project not found");

    const maxOrd = project.stages.length ? Math.max(...project.stages.map((s) => s.ordinal)) : 0;
    const ordinal = dto.ordinal ?? maxOrd + 1;
    if (project.stages.some((s) => s.ordinal === ordinal)) {
      throw new BadRequestException(`Ya existe una etapa con ordinal ${ordinal}`);
    }

    let mddContent: string | null = null;
    let stStatus: Status = Status.ROJO;
    let precisionScore = 0;
    let legacyChangeState: any = null;
    if (dto.copyMddFromStageId?.trim()) {
      const copyFrom = dto.copyMddFromStageId.trim();
      const src = project.stages.find((s) => s.id === copyFrom);
      if (!src) throw new BadRequestException("copyMddFromStageId no pertenece al proyecto");
      mddContent = src.mddContent;
      stStatus = src.status;
      precisionScore = src.precisionScore;
    }
    if (dto.copyLegacyChangeFromStageId?.trim()) {
      const copyFrom = dto.copyLegacyChangeFromStageId.trim();
      const src = project.stages.find((s) => s.id === copyFrom);
      if (!src) throw new BadRequestException("copyLegacyChangeFromStageId no pertenece al proyecto");
      legacyChangeState = src.legacyChangeState as object | null;
    }

    const isLegacy = project.projectType === "LEGACY";
    const newStage = await this.prisma.stage.create({
      data: {
        projectId,
        ordinal,
        key: dto.key ?? `stage_${ordinal}`,
        name: dto.name?.trim() ?? `Etapa ${ordinal}`,
        workflowStatus: StageStatus.DRAFT,
        mddContent,
        status: stStatus,
        precisionScore,
        legacyChangeState,
        isLegacy,
        theforgeProjectId: project.theforgeProjectId,
      },
    });

    if (dto.activate !== false) {
      await this.activateStageExclusive(projectId, newStage.id);
    }

    const withEst = await this.prisma.stage.findUnique({
      where: { id: newStage.id },
      include: { estimation: true },
    });
    if (withEst?.mddContent?.trim()) {
      await this.estimationRecalc.recalcAndUpsert(withEst.id, {
        mddContent: withEst.mddContent,
        infraContent: project.infraContent ?? null,
        status: withEst.status,
      });
    }

    const out = await this.prisma.stage.findFirst({
      where: { id: newStage.id },
      include: { estimation: true },
    });
    if (!out) throw new NotFoundException("Etapa no encontrada tras crear");

    // Cambio 3: Sincronizar con FalkorDB al crear etapa — nodo + relación con línea base
    if (isLegacy) {
      // Sincronizar nodo LegacyStage
      this.graphMemory.syncLegacyStage({
        stageId: out.id,
        projectId,
        ordinal: out.ordinal,
        name: out.name ?? "",
        theforgeProjectId: project.theforgeProjectId ?? undefined,
      }).catch(() => {});
      // Relacionar con etapa anterior (ordinal N-1) para FalkorDB DERIVED_FROM
      if (out.ordinal > 1) {
        const parentOrdinal = out.ordinal - 1;
        const parentStage = project.stages.find((s) => s.ordinal === parentOrdinal);
        if (parentStage) {
          this.graphMemory.syncLegacyStage({
            stageId: out.id,
            projectId,
            ordinal: out.ordinal,
            name: out.name ?? "",
            parentStageId: parentStage.id,
            theforgeProjectId: project.theforgeProjectId ?? undefined,
          }).catch(() => {});
        }
      }
    }

    return { stage: out };
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

  private assertBlueprintCoversMddDataModel(project: Project & { stages: StageWithEst[] }): void {
    const mdd = this.constitutionMarkdown(project);
    const dm = this.conformance.checkBlueprintDataModel(mdd, project.blueprintContent);
    if (!dm.ok) {
      throw new BadRequestException({
        message:
          "El Blueprint debe reflejar el modelo de datos del MDD (§3) antes de generar Contratos API. Corrija el Blueprint o regenérelo.",
        code: "BLUEPRINT_DATA_MODEL_GAPS",
        gaps: dm.gaps,
      });
    }
  }

  /** Opciones legacy (etapa 1 AS-IS + TheForge) para regeneración individual en Workshop. */
  private async resolveLegacyGenerateOptions(
    project: Project & { stages: StageWithEst[] },
  ): Promise<LegacyGenerateOptions | undefined> {
    const p = project as { projectType?: string; theforgeProjectId?: string | null };
    return buildLegacyGenerateOptions({
      projectType: p.projectType,
      theforgeProjectId: p.theforgeProjectId ?? null,
      mddMarkdown: this.constitutionMarkdown(project),
      stages: project.stages,
      theforgeConfigured: this.theforge.isConfigured(),
      getContextForDeliverables: (id) => this.theforge.getContextForDeliverables(id),
      gatherContractSpecsForApi: (id) => this.theforge.gatherContractSpecsForApi(id),
    });
  }

  /** Tras regen individual de flujos legacy etapa 1: telemetría §5 en `legacyFlowState`. */
  private async persistLegacyLogicFlowsCoverageDebug(
    projectId: string,
    project: Project & { stages: StageWithEst[] },
    logicFlowsMarkdown: string,
    legacyOpts: LegacyGenerateOptions | undefined,
  ): Promise<void> {
    if (!legacyOpts?.legacyBaselineStage) return;
    const mdd = this.constitutionMarkdown(project);
    const services = extractSection5Services(mdd);
    const batchSize = readLogicFlowsBatchSize();
    const batchCount =
      services.length > batchSize ? Math.ceil(services.length / batchSize) : undefined;
    const coverage = toLogicFlowsSection5CoverageReport(
      scoreLogicFlowsSection5Coverage(mdd, logicFlowsMarkdown),
      batchCount !== undefined ? { batchCount } : undefined,
    );
    await patchLegacyDeliverablesDebugReport(
      this.prisma,
      projectId,
      {
        legacyBaselineStage: true,
        logicFlowsSection5Coverage: coverage,
      },
      pickPrimaryStage(project.stages ?? [])?.id,
    );
  }

  async patchStage(projectId: string, stageId: string, body: unknown) {
    const dto = patchStageBodySchema.parse(body);
    const uid = getRequestUserId();
    // Verificar acceso SHARED/PRIVATE
    await this.assertProjectAccess(projectId);
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, projectId },
      include: { estimation: true },
    });
    if (!stage) throw new NotFoundException("Etapa no encontrada");

    // Solo el owner puede activar etapas o cambiar ordinal (cambios estructurales)
    const ownerId = (await this.prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } }))?.userId;
    const isOwner = ownerId === uid;
    if ((dto.activate === true || dto.ordinal !== undefined) && !isOwner) {
      throw new BadRequestException("Only the project owner can restructure stages");
    }
    if (dto.activate === true) {
      await this.activateStageExclusive(projectId, stageId);
    }

    const data: Prisma.StageUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.key !== undefined) data.key = dto.key.trim();
    if (dto.brdContent !== undefined) data.brdContent = dto.brdContent.trim() || null;
    if (dto.ordinal !== undefined) {
      const clash = await this.prisma.stage.findFirst({
        where: {
          projectId,
          ordinal: dto.ordinal,
          NOT: { id: stageId },
        },
      });
      if (clash) throw new BadRequestException(`Ordinal ${dto.ordinal} ya está en uso`);
      data.ordinal = dto.ordinal;
    }

    const terminalStatuses: StageStatus[] = [
      StageStatus.COMPLETED,
      StageStatus.ARCHIVED,
      StageStatus.SUPERSEDED,
    ];
    if (dto.workflowStatus !== undefined) {
      data.workflowStatus = dto.workflowStatus as StageStatus;
      if (terminalStatuses.includes(dto.workflowStatus as StageStatus)) {
        await ensureStageDeliverableSnapshotIfMissing(this.prisma, stageId, projectId, {
          source: "manual",
        }).catch((err) =>
          this.logger.warn(
            `[Stage] snapshot on ${dto.workflowStatus}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
      if (dto.workflowStatus === StageStatus.ACTIVE) {
        await this.activateStageExclusive(projectId, stageId);
      }
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.stage.update({ where: { id: stageId }, data });
    }

    // Bitácora para brdContent
    if (dto.brdContent !== undefined) {
      await this.changeLog.log(projectId, "brdContent", dto.brdContent);
    }

    const out = await this.prisma.stage.findFirst({
      where: { id: stageId, projectId },
      include: { estimation: true },
    });
    if (!out) throw new NotFoundException("Etapa no encontrada");
    return { stage: out };
  }

  async generateBenchmark(projectId: string, userIdea: string, urls?: string[]) {
    await this.assertProjectAccess(projectId);
    const resolvedUrls = resolveUrls(urls, userIdea);
    let scrapedContext: string | undefined;
    if (resolvedUrls.length > 0) {
      console.log("[generateBenchmark] URLs a scrapear:", resolvedUrls.length, resolvedUrls);
      const pages = await this.scraper.scrapeUrls(resolvedUrls);
      const ok = pages.filter((p) => p.markdown.trim().length > 0);
      const failed = pages.filter((p) => p.error || !p.markdown.trim());
      if (failed.length > 0) {
        console.warn("[generateBenchmark] URLs sin contenido o error:", failed.map((p) => ({ url: p.url, error: p.error })));
      }
      scrapedContext = ok.map((p) => `## Referencia: ${p.url}\n\n${p.markdown}`).join("\n\n");
      console.log("[generateBenchmark] Scraped context:", scrapedContext?.length ?? 0, "chars,", ok.length, "páginas OK");
    } else {
      console.log("[generateBenchmark] Sin URLs en idea/body; no se hace scraping.");
    }
    const dbgaContent = await this.discovery.generateBenchmark(userIdea, scrapedContext);
    const trimmed = dbgaContent.trim();
    let proposal: ComplexityPending;
    try {
      proposal = await this.discovery.inferComplexityProposal(userIdea, trimmed);
    } catch {
      proposal = {
        level: ComplexityLevel.HIGH,
        planSummary: "Constitución SDD completa.",
        reason: "Inferencia no disponible; se propone HIGH por defecto.",
      };
    }
    return this.update(projectId, {
      dbgaContent: trimmed,
      complexityPending: proposal,
    });
  }

  /**
   * Re-infiere `complexityPending` (HITL) desde DBGA / MDD / Spec ya existentes, sin re-ejecutar el stream DBGA.
   * Útil para proyectos existentes que quieren re-valorar el nivel según el alcance documentado.
   */
  async reassessComplexity(projectId: string, options?: { note?: string }) {
    const project = await this.assertProjectAccess(projectId);

    const dbga = (project.dbgaContent ?? "").trim();
    const mdd = this.mddFromStages(project.stages).trim();
    const spec = (project.specContent ?? "").trim();
    const phase0 = (project.phase0SummaryContent ?? "").trim();

    const chunks: string[] = [];
    if (dbga.length > 0) chunks.push(dbga);
    if (mdd.length > 0) chunks.push(mdd);
    if (spec.length > 0) chunks.push(spec);
    if (phase0.length > 0 && chunks.join("").length < 400) chunks.push(phase0);

    const context = chunks.join("\n\n---\n\n").slice(0, 24_000);
    if (context.trim().length < 80) {
      throw new BadRequestException(
        "No hay suficiente contexto (DBGA y/o MDD de etapa, Spec). En legacy asegúrate de tener MDD de cambio; en producto nuevo, Paso 0 o MDD.",
      );
    }

    const note = options?.note?.trim();
    const idea =
      note && note.length > 0
        ? note.slice(0, 6000)
        : `Re-valoración de complejidad del proyecto «${project.name}» según el alcance actual documentado.`;

    let proposal: ComplexityPending;
    try {
      proposal = await this.discovery.inferComplexityProposal(idea, context);
    } catch {
      proposal = {
        level: ComplexityLevel.HIGH,
        planSummary: "Constitución SDD completa.",
        reason: "Inferencia no disponible; se propone HIGH por defecto.",
      };
    }
    return this.update(projectId, { complexityPending: proposal });
  }

  /** Aplica la propuesta pendiente a `complexity` y limpia HITL (tras confirmación explícita del usuario). */
  async confirmComplexityProposal(projectId: string) {
    const row = await this.prisma.project.findFirst({ where: this.projectWhereForUser(projectId) });
    if (!row) throw new NotFoundException("Project not found");
    const raw = row.complexityPending;
    if (raw == null || typeof raw !== "object" || !("level" in raw)) {
      throw new BadRequestException("No hay propuesta de complejidad pendiente de confirmar.");
    }
    const level = (raw as { level: string }).level as ComplexityLevel;
    return this.update(projectId, {
      complexity: level,
      clearComplexityPending: true,
    });
  }

  /**
   * Interpreta mensajes cortos del chat del Workshop para confirmar o rechazar la propuesta HITL.
   * @returns si se aplicó confirmación o rechazo (y el proyecto debió refrescarse).
   */
  tryConfirmComplexityFromChatMessage(projectId: string, message: string): Promise<{
    confirmed: boolean;
    rejected: boolean;
  }> {
    return this._tryConfirmComplexityFromChatMessage(projectId, message);
  }

  private async _tryConfirmComplexityFromChatMessage(
    projectId: string,
    message: string,
  ): Promise<{ confirmed: boolean; rejected: boolean }> {
    const row = await this.prisma.project.findFirst({ where: this.projectWhereForUser(projectId) });
    if (!row?.complexityPending) return { confirmed: false, rejected: false };
    const t = message.trim().toLowerCase();
    const confirm =
      /^(sí|si|de acuerdo|ok|confirmo|adelante|vale|correcto)\b/.test(t) ||
      /ejecuta este plan|acepto el plan|aplica el plan|sí,?\s*ejecuta|confirmar plan/.test(t);
    const reject =
      /^(no|mejor|prefiero|cancelar)\b/.test(t) || /rechazo|no quiero|otro nivel/.test(t);
    if (confirm && !reject) {
      await this.confirmComplexityProposal(projectId);
      return { confirmed: true, rejected: false };
    }
    if (reject) {
      await this.update(projectId, { clearComplexityPending: true });
      return { confirmed: false, rejected: true };
    }
    return { confirmed: false, rejected: false };
  }

  /**
   * Guía UX/UI generada por LLM (mismo criterio que legacy, sin Relic).
   */
  async generateUxUiGuide(projectId: string) {
    const project = await this.assertProjectAccess(projectId);
    const mdd = this.constitutionMarkdown(project);
    const bp = (project.blueprintContent ?? "").trim();

    // P0: default auto-match si el proyecto aún no tiene referencia
    if (!project.uxGuideDesignRef?.trim()) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { uxGuideDesignRef: "auto" },
      });
      project.uxGuideDesignRef = "auto";
    }

    const uxPrompt =
      "Genera la Guía UX/UI completa en markdown según tu rol. El contexto (resumen MDD, Blueprint y documentos SDD) está en el system prompt. Termina el documento con la línea exacta ---FIN_UX_UI--- y deja un mensaje breve para el usuario después.";
    const mddBrief = buildMddContextForUxGuide(mdd);
    const raw = await this.ai.generateResponse(uxPrompt, [], {
      systemPrompt: UX_UI_GUIDE_PROMPT,
      activeTab: "ux-ui-guide",
      currentMddContent: mddBrief || undefined,
      currentBlueprintContent: bp || undefined,
      ...uxGuideLlmOptions(project, mdd),
    });
    const clean = (raw ?? "").replace(/\n?-{1,}FIN_UX_UI-{1,}[\s\S]*$/i, "").trim();
    if (!clean) {
      // LLM no generó contenido de documento (solo chat) — no persistas nada
      this.logger.warn(`[generateUxUiGuide] LLM returned empty content for project ${projectId}`);
      return project;
    }
    // Si el LLM no generó YAML frontmatter, agregar uno por defecto
    let finalContent = cleanDocumentContent(clean);
    if (!finalContent.startsWith("---")) {
      const name = project.name ?? projectId;
      finalContent = `---
name: ${JSON.stringify(name)}
---
\n\n${finalContent}`;
    }
    // Design system inferido del MCP gráfico compatible activo (fallback: heurístico/Ariadne del LLM).
    finalContent = await this.appendUiMcpDesignSystem(finalContent);
    finalContent = appendUxGuideDesignAttribution(finalContent, project.uxGuideDesignRef, mdd);
    return this.update(projectId, { uxUiGuideContent: finalContent });
  }

  /**
   * Design System determinista desde biblioteca (DESIGN.md importado o catálogo builtin).
   * Sin LLM: auto-match heurístico + composición local.
   */
  async composeUxGuideFromDesignRef(projectId: string): Promise<{
    composed: boolean;
    uxUiGuideContent?: string | null;
    effectiveSlug?: string;
    source?: string;
    referenceName?: string;
    reason?: string;
    lint?: DesignMdLintResult;
  }> {
    const project = await this.assertProjectAccess(projectId);
    const mdd = this.constitutionMarkdown(project);
    const projectName = project.name || projectId;
    const storedRef = project.uxGuideDesignRef?.trim() ?? null;

    // Rama URL personalizada: escanea el sitio y compone con sus colores reales.
    if (storedRef?.startsWith("url:")) {
      const url = storedRef.slice("url:".length).trim();
      const scan = await scanUrlForDesignTokens(url);
      if ("error" in scan) {
        this.logger.warn(`[scan-url] project=${projectId} url=${url} fallo: ${scan.error}`);
        return { composed: false, reason: "url-scan-failed" };
      }
      const content = cleanDocumentContent(
        composeDesignSystemFromScannedTokens(projectName, scan.tokens),
      );
      const updated = await this.update(projectId, { uxUiGuideContent: content });
      const lint = await this.lintUxGuideContent(content, projectId, storedRef);
      return {
        composed: true,
        uxUiGuideContent: updated.uxUiGuideContent,
        effectiveSlug: storedRef,
        source: "url-scan",
        referenceName: scan.tokens.name,
        lint,
      };
    }

    const composed = composeDesignSystemFromRef({
      projectName,
      storedRef: project.uxGuideDesignRef,
      mddContext: mdd,
    });
    if (!composed) {
      return { composed: false, reason: "no-reference-match" };
    }

    let finalContent = cleanDocumentContent(composed.content);
    finalContent = appendUxGuideDesignAttribution(finalContent, project.uxGuideDesignRef, mdd);
    const updated = await this.update(projectId, { uxUiGuideContent: finalContent });

    const lint = await this.lintUxGuideContent(finalContent, projectId, composed.effectiveSlug);

    return {
      composed: true,
      uxUiGuideContent: updated.uxUiGuideContent,
      effectiveSlug: composed.effectiveSlug,
      source: composed.source,
      referenceName: composed.referenceName,
      lint,
    };
  }

  /**
   * Valida el DESIGN.md generado con el CLI oficial `@google/design.md` y
   * registra un resumen (contraste WCAG, orden de secciones, refs rotas).
   * Nunca lanza: el linter es informativo y no bloquea el pipeline.
   */
  private async lintUxGuideContent(
    content: string,
    projectId: string,
    effectiveSlug?: string,
  ): Promise<DesignMdLintResult> {
    const lint = await lintDesignMd(content);
    if (lint.unavailable) return lint;

    const scope = `[design.md lint] project=${projectId} ref=${effectiveSlug ?? "-"}`;
    const summary = formatLintSummary(lint);
    if (lint.summary.errors > 0) {
      this.logger.warn(`${scope} ${summary}`);
    } else if (lint.summary.warnings > 0) {
      this.logger.log(`${scope} ${summary}`);
    }

    for (const finding of lint.findings) {
      if (finding.severity === "info") continue;
      const where = finding.path ? ` (${finding.path})` : "";
      const line = `${scope} ${finding.severity}${where}: ${finding.message}`;
      if (finding.severity === "error") this.logger.warn(line);
      else this.logger.log(line);
    }

    return lint;
  }

  /**
   * Repara/regenera solo el YAML frontmatter de la Guía UX/UI usando el MDD como contexto.
   * NO regenera el cuerpo markdown — solo los tokens de diseño (colors, typography, etc.).
   * Útil cuando el LLM generó el markdown pero sin YAML, o el YAML está incompleto.
   */
  async repairUxUiGuideYaml(projectId: string): Promise<string> {
    const project = await this.assertProjectAccess(projectId);
    const mdd = this.constitutionMarkdown(project);
    const bp = (project.blueprintContent ?? "").trim();
    const spec = (project.specContent ?? "").trim();
    const name = project.name || projectId;

    const repairPrompt =
      `Eres un diseñador UX/UI experto. Genera ÚNICAMENTE el YAML frontmatter del archivo DESIGN.md ` +
      `para el proyecto "${name}", basándote en el contexto del MDD, Blueprint y Spec que recibes.\n\n` +
      `IMPORTANTE: Responde ÚNICAMENTE con el bloque YAML entre --- y ---. NO incluyas secciones markdown, ` +
      `ni texto explicativo, ni bloques \`\`\` alrededor.\n\n` +
      `El YAML debe tener esta estructura:\n` +
      `---\n` +
      `version: alpha\n` +
      `name: "${name}"\n` +
      `description: "Frase corta que capture la personalidad visual del proyecto"\n` +
      `colors:\n` +
      `  primary: "#<Hex>"\n` +
      `  secondary: "#<Hex>"\n` +
      `  tertiary: "#<Hex>"\n` +
      `  neutral: "#<Hex>"\n` +
      `  foreground: "#<Hex>"\n` +
      `  background: "#<Hex>"\n` +
      `  muted: "#<Hex>"\n` +
      `  border: "#<Hex>"\n` +
      `  danger: "#<Hex>"\n` +
      `  success: "#<Hex>"\n` +
      `  warning: "#<Hex>"\n` +
      `  info: "#<Hex>"\n` +
      `typography:\n` +
      `  font-sans: ["Inter", "system-ui", "sans-serif"]\n` +
      `  h1: { fontFamily: "...", fontSize: 32px, fontWeight: 700, lineHeight: 40px, letterSpacing: "-0.02em" }\n` +
      `  h2: { similar }\n` +
      `  h3: { similar }\n` +
      `  body-md: { fontFamily: "...", fontSize: 16px, fontWeight: 400, lineHeight: 24px }\n` +
      `  body-sm: { similar }\n` +
      `  label-sm: { similar }\n` +
      `rounded:\n` +
      `  none: 0px\n` +
      `  sm: 6px\n` +
      `  md: 12px\n` +
      `  lg: 20px\n` +
      `  xl: 28px\n` +
      `  full: 9999px\n` +
      `spacing:\n` +
      `  xxs: 2px\n` +
      `  xs: 4px\n` +
      `  sm: 8px\n` +
      `  md: 16px\n` +
      `  lg: 24px\n` +
      `  xl: 32px\n` +
      `  2xl: 48px\n` +
      `  3xl: 64px\n` +
      `elevation:\n` +
      `  card: { boxShadow: "..." }\n` +
      `  dropdown: { boxShadow: "..." }\n` +
      `  modal: { boxShadow: "..." }\n` +
      `  sticky: { boxShadow: "..." }\n` +
      `components:\n` +
      `  button-primary: { backgroundColor, textColor, rounded, padding, typography }\n` +
      `  button-secondary: { ... }\n` +
      `  button-ghost: { ... }\n` +
      `  button-danger: { ... }\n` +
      `  card: { ... }\n` +
      `  badge: { ... }\n` +
      `  input: { ... }\n` +
      `  modal: { ... }\n` +
      `  toast: { ... }\n` +
      `  skeleton: { ... }\n` +
      `---\n\n` +
      `Contexto del proyecto:\n` +
      `${mdd ? `## Resumen MDD (design system)\n${buildMddContextForUxGuide(mdd)}` : ""}\n\n` +
      `${bp ? `## Blueprint\n${bp.slice(0, 3000)}` : ""}\n\n` +
      `${spec ? `## Spec\n${spec.slice(0, 2000)}` : ""}\n\n` +
      `NO incluyas secciones markdown, solo el bloque YAML.`;

    const mddBrief = buildMddContextForUxGuide(mdd);
    const raw = await this.ai.generateResponse(repairPrompt, [], {
      systemPrompt: UX_UI_GUIDE_PROMPT,
      activeTab: "ux-ui-guide",
      currentMddContent: mddBrief || undefined,
      currentBlueprintContent: bp || undefined,
      ...uxGuideLlmOptions(project, mdd),
    });

    const trimmed = (raw ?? "").trim();
    // Extract YAML block (between --- markers)
    const yamlMatch = trimmed.match(/^---\n([\s\S]*?)\n---/);
    if (!yamlMatch) {
      // Maybe the LLM returned just the YAML without --- markers, or with extra text
      // Try to find any YAML-like structure
      if (trimmed.startsWith("---")) {
        // Already a frontmatter block, extract it
        const endIdx = trimmed.indexOf("---", 3);
        if (endIdx !== -1) {
          return trimmed.slice(0, endIdx + 3);
        }
        return trimmed;
      }
      this.logger.warn(`[repairUxUiGuideYaml] No YAML block found in LLM response for ${projectId}`);
      // Return minimal default YAML
      return `---
name: ${JSON.stringify(name)}
---`;
    }

    return `---\n${yamlMatch[1]!.trim()}\n---`;
  }

  /**
   * [UNIFIED] Genera cualquier documento del pipeline. Usado tanto por la cascada
   * (generateDeliverablesCascade) como por los endpoints individuales (controller.queueOrSync).
   */
  async generateDocument(
    kind: DeliverableKind,
    projectId: string,
    options?: { gapsFeedback?: string | null },
  ): Promise<void> {
    await this.assertDeliverablesAllowed(projectId);
    const gaps = options?.gapsFeedback ?? undefined;
    switch (kind) {
      case "mdd_canonical":
        return;
      case "spec":
        await this.generateSpec(projectId);
        return;
      case "architecture":
        await this.generateArchitecture(projectId, gaps);
        return;
      case "use_cases":
        await this.generateUseCases(projectId);
        return;
      case "blueprint":
        await this.generateBlueprint(projectId, gaps);
        return;
      case "api_contracts":
        await this.ensureBlueprintForApi(projectId);
        await this.generateApiContracts(projectId, gaps);
        return;
      case "logic_flows":
        await this.generateLogicFlows(projectId, gaps);
        return;
      case "ux_ui_guide":
        await this.generateUxUiGuide(projectId);
        return;
      case "user_stories":
        await this.generateUserStories(projectId);
        return;
      case "agent_governance":
        await this.generateAgentGovernance(projectId);
        return;
      case "tasks":
        await this.generateTasks(projectId, gaps);
        return;
      case "infra":
        await this.generateInfra(projectId, gaps);
        return;
      case "evd":
        await this.generateEVD(projectId);
        return;
      default: {
        const _exhaustive: never = kind;
        return _exhaustive;
      }
    }
  }

  private async ensureBlueprintForApi(projectId: string): Promise<void> {
    const project = await this.assertProjectAccess(projectId).catch(() => null);
    if (!project) return;
    if ((project.blueprintContent ?? "").trim().length > 48) return;
    await this.generateBlueprint(projectId);
  }

  private async runDeliverableWaveStep(
    step: DeliverableWaveStep,
    projectId: string,
    gapsFeedback?: string | null,
  ): Promise<void> {
    if (step === "ui_screens_sync") {
      await this.runCascadeUiScreensSync(projectId);
      return;
    }
    await this.runDeliverableStep(step, projectId, gapsFeedback ? { gapsFeedback } : undefined);
  }

  /** Sync pantallas tras W2; no falla la cascada si no hay MCP activo. */
  private async runCascadeUiScreensSync(projectId: string): Promise<void> {
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

  private buildExistingConformanceGapsMap(
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

  /** W4: reintenta artefactos con gaps de precisión SDD (upstream en paralelo; tasks al final). */
  private async runCascadePostPassRetry(projectId: string): Promise<void> {
    const project = await this.findOne(projectId);
    const mdd = this.constitutionMarkdown(project);
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
    if (precisionGaps.length === 0) return;

    const feedback = formatPrecisionGapsFeedback(precisionGaps);
    const flags = precisionGapsForPostPassRetry(precisionGaps);
    this.logger.warn(
      `[Cascade] Post-pase W4: ${precisionGaps.length} gap(s) de precisión — retry dirigido`,
    );

    const upstreamRetries: Array<Promise<unknown>> = [];
    if (flags.retryArchitecture) {
      upstreamRetries.push(
        this.generateArchitecture(projectId, feedback).catch((e) =>
          this.logger.warn(`[Cascade] W4 architecture retry: ${e instanceof Error ? e.message : e}`),
        ),
      );
    }
    if (flags.retryLogicFlows) {
      upstreamRetries.push(
        this.generateLogicFlows(projectId, feedback).catch((e) =>
          this.logger.warn(`[Cascade] W4 logic-flows retry: ${e instanceof Error ? e.message : e}`),
        ),
      );
    }
    if (flags.retryApiContracts) {
      upstreamRetries.push(
        this.generateApiContracts(projectId, feedback).catch((e) =>
          this.logger.warn(`[Cascade] W4 api-contracts retry: ${e instanceof Error ? e.message : e}`),
        ),
      );
    }

    if (upstreamRetries.length > 0) {
      await Promise.allSettled(upstreamRetries);
    }

    if (flags.retryTasks) {
      await this.generateTasks(projectId, feedback).catch((e) =>
        this.logger.warn(`[Cascade] W4 tasks retry: ${e instanceof Error ? e.message : e}`),
      );
    }
  }

  private async runDeliverableStep(kind: DeliverableKind, projectId: string, options?: { gapsFeedback?: string | null }): Promise<void> {
    return this.generateDocument(kind, projectId, options);
  }

  /**
   * Enrutamiento dinámico: solo ejecuta generadores listados en `DELIVERABLES_BY_COMPLEXITY`.
   * @param onProgress — opcional (p. ej. BullMQ `job.updateProgress`).
   */
  async generateDeliverablesCascade(
    projectId: string,
    onProgress?: (p: { step: DeliverableKind; index: number; total: number }) => void,
    options?: { acknowledgeGaps?: boolean },
  ) {
    await this.assertDeliverablesAllowed(projectId, options);
    const project = await this.assertProjectAccess(projectId);
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
    const reportProgress = (step: DeliverableWaveStep) => {
      onProgress?.({
        step: (step === "ui_screens_sync" ? "ux_ui_guide" : step) as DeliverableKind,
        index: completedCount,
        total,
      });
      completedCount++;
    };

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex]!;
      const projectFresh = await this.findOne(projectId);
      const mddContent = this.constitutionMarkdown(projectFresh);
      const gapsMap = this.buildExistingConformanceGapsMap(projectFresh, mddContent, wave);

      await Promise.allSettled(
        wave.map(async (step: DeliverableWaveStep) => {
          try {
            const stepGaps = step !== "ui_screens_sync" ? gapsMap.get(step) : undefined;
            await this.runDeliverableWaveStep(step, projectId, stepGaps ?? undefined);
          } catch (e) {
            const message = e instanceof Error ? e.message : "Error desconocido";
            this.logger.warn(`[Cascade] Paso ${step} saltado: ${message}.`);
            errors.push({ step, error: message });
          }
          reportProgress(step);
        }),
      );
    }

    await this.runCascadePostPassRetry(projectId).catch((err) =>
      this.logger.warn(
        `[Cascade] post-pass W4: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );

    await this.refreshStageSemaphoreFromProject(projectId).catch((err) =>
      this.logger.warn(
        `[Cascade] refresh semaphore: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );

    onProgress?.({ step: "done" as DeliverableKind, index: total - 1, total });
    if (errors.length > 0) {
      this.logger.warn(
        `[Cascade] Completada con ${errors.length}/${total} paso(s) saltado(s): ${errors.map((e) => `${e.step}: ${e.error}`).join("; ")}`,
      );
    }
    const result = await this.findOne(projectId);
    const activeStage = pickPrimaryStage(result.stages ?? []);
    if (activeStage?.id) {
      await persistStageDeliverableSnapshotFromProject(this.prisma, activeStage.id, result, {
        source: "cascade",
      }).catch((err) =>
        this.logger.warn(
          `[Cascade] deliverableSnapshot: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      await this.runPostRegenSddConflictSurfacing(result.id).catch((err) =>
        this.logger.warn(
          `[Cascade] sddConflictSurfacing: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
    return result;
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

  private async syncSddConflictGapsForProject(
    project: Project & { stages: StageWithEst[] },
    _stageId: string,
  ): Promise<void> {
    await this.runPostRegenSddConflictSurfacing(project.id);
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
    return this.update(projectId, { phase0SummaryContent: summary.trim() });
  }

  async generateAem(projectId: string, body: unknown) {
    const parsed = generateAemBodySchema.parse(body ?? {});
    const project = await this.assertProjectAccess(projectId);

    const dbga = (project.dbgaContent ?? "").trim();
    const summaryRaw = (project.phase0SummaryContent ?? "").trim();
    const benchmarkContent =
      summaryRaw && !isPhase0BorradorJson(summaryRaw) ? summaryRaw : "";

    let phase0Content = dbga;
    if (!phase0Content) {
      const borrador = loadProjectBorrador(project.dbgaContent, project.phase0SummaryContent);
      if (hasBorradorContent(borrador)) {
        phase0Content = phase0ToMarkdown(borrador);
      }
    }

    const stage = pickPrimaryStage(project.stages ?? []);
    const brdContent = (stage?.brdContent ?? "").trim();

    if (!benchmarkContent && !phase0Content && !brdContent) {
      throw new BadRequestException(
        "Se requiere al menos Benchmark (Deep Research), Fase 0 (DBGA) o BRD para generar el AEM.",
      );
    }

    let content: string;
    try {
      const aemMarkdown = await this.ai.generateAem({
        marketScope: parsed.marketScope,
        benchmarkContent,
        phase0Content,
        brdContent,
        projectName: project.name,
      });
      const advisory = await this.ai.generateAemInvestmentAdvisory({
        aemContent: aemMarkdown,
        marketScope: parsed.marketScope,
        projectName: project.name,
        benchmarkContent,
        phase0Content,
        brdContent,
      });
      content = `${aemMarkdown.trim()}\n\n${advisory.trim()}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar AEM";
      throw new Error(`Falló la generación del AEM. ${message.slice(0, 200)}`);
    }

    return this.update(projectId, { aemContent: cleanDocumentContent(content) });
  }

  async generateSpec(projectId: string) {
    const project = await this.assertProjectAccess(projectId);
    if ((project as { projectType?: string }).projectType === "LEGACY") {
      throw new BadRequestException(
        "Generar Spec con este flujo es solo para proyectos nuevos. En legacy usa el flujo de entregables legacy.",
      );
    }
    const dbga = (project.dbgaContent ?? "").trim();
    const rawMdd = this.mddFromStages(project.stages).trim();
    const inputContent = dbga || rawMdd || this.constitutionMarkdown(project).trim();
    const specContent = await this.ai.generateSpec(
      inputContent,
      project.phase0SummaryContent,
      dbga.length === 0 && rawMdd.length > 0 ? "mdd" : "dbga",
    );
    return this.update(projectId, { specContent: cleanDocumentContent(specContent) });
  }

  async generateEvd(projectId: string) {
    // Delega al pipeline completo con Visual Stylist Agent
    await this.generateEVD(projectId);
    return this.assertProjectAccess(projectId);
  }

  /** Limpia gobernanza persistida antes de regenerar (polling y UI). */
  async clearAgentGovernanceContent(projectId: string) {
    return this.update(projectId, { agentGovernanceContent: null });
  }

  async generateAgentGovernance(
    projectId: string,
    target?: string,
    options?: { forceRegenerate?: boolean; skipSddAutoReconcile?: boolean },
  ) {
    const forceRegenerate = options?.forceRegenerate !== false;
    const project = await this.assertProjectAccess(projectId);
    const beforeLen = (project.agentGovernanceContent ?? "").length;
    this.logger.debug(
      `[agent-gov] generateAgentGovernance start projectId=${projectId} force=${forceRegenerate} beforeLen=${beforeLen}`,
    );
    if (forceRegenerate) {
      this.logger.debug(`[agent-gov] generateAgentGovernance clearing agentGovernanceContent projectId=${projectId}`);
      await this.clearAgentGovernanceContent(projectId);
    }
    const complexity = project.complexity ?? ComplexityLevel.HIGH;
    const mdd = this.constitutionMarkdown(project);
    const stage = pickPrimaryStage(project.stages);
    const governanceInput = buildAgentGovernanceInput(project, mdd, complexity, stage);
    const featureDir = specKitFeatureDir(stage?.ordinal ?? 1, project.name);
    const suggestions = suggestAgentGovernanceArtifacts(governanceInput);
    this.logger.debug(
      `[agent-gov] generateAgentGovernance input keys=${Object.keys(governanceInput).join(",")} archetypes=${suggestions.archetypes.length} rules=${suggestions.suggestedRules.length} skills=${suggestions.suggestedSkills.length}`,
    );
    const raw = await this.ai.generateAgentGovernance(mdd, project.blueprintContent, complexity, {
      suggestions,
      tasksContent: project.tasksContent,
      architectureContent: project.architectureContent,
      specContent: project.specContent,
      apiContractsContent: project.apiContractsContent,
      logicFlowsContent: project.logicFlowsContent,
      uxUiGuideContent: project.uxUiGuideContent,
      uiScreensContent: project.uiScreensContent,
      infraContent: project.infraContent,
      userStoriesContent: project.userStoriesContent,
      useCasesContent: project.useCasesContent,
    });
    const forceFreshOverlay = forceRegenerate;
    const scaffold = parseAgentGovernanceResponse(raw, complexity, {
      suggestions,
      governanceInput,
      target,
      forceFreshOverlay,
      featureDir,
    });
    const serialized = serializeAgentGovernanceScaffold(scaffold);
    this.logger.debug(
      `[agent-gov] generateAgentGovernance done projectId=${projectId} beforeLen=${beforeLen} afterLen=${serialized.length} files=${scaffold.files.length}`,
    );
    const updated = await this.update(projectId, {
      agentGovernanceContent: serialized,
    });
    if (options?.skipSddAutoReconcile !== true) {
      const activeStage = pickPrimaryStage(updated.stages ?? []);
      if (activeStage?.id) {
        await this.syncSddConflictGapsForProject(updated, activeStage.id).catch((err) =>
          this.logger.warn(
            `[agent-gov] sddConflictSurfacing: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    }
    return updated;
  }

  async generateAgentGovernancePreview(
    projectId: string,
    target?: string,
    options?: { forceRegenerate?: boolean },
  ): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    const complexity = project.complexity ?? ComplexityLevel.HIGH;
    const mdd = this.constitutionMarkdown(project);
    const stage = pickPrimaryStage(project.stages);
    const governanceInput = buildAgentGovernanceInput(project, mdd, complexity, stage);
    const featureDir = specKitFeatureDir(stage?.ordinal ?? 1, project.name);
    const suggestions = suggestAgentGovernanceArtifacts(governanceInput);
    const raw = await this.ai.generateAgentGovernance(mdd, project.blueprintContent, complexity, {
      suggestions,
      tasksContent: project.tasksContent,
      architectureContent: project.architectureContent,
      specContent: project.specContent,
      apiContractsContent: project.apiContractsContent,
      logicFlowsContent: project.logicFlowsContent,
      uxUiGuideContent: project.uxUiGuideContent,
      uiScreensContent: project.uiScreensContent,
      infraContent: project.infraContent,
      userStoriesContent: project.userStoriesContent,
      useCasesContent: project.useCasesContent,
    });
    const forceFreshOverlay = options?.forceRegenerate !== false;
    const scaffold = parseAgentGovernanceResponse(raw, complexity, {
      suggestions,
      governanceInput,
      target,
      forceFreshOverlay,
      featureDir,
    });
    return { content: serializeAgentGovernanceScaffold(scaffold) };
  }

  /** Scaffold listo para ZIP: reconcilia sugerencias, rutas obligatorias y entregables SDD. */
  async getAgentGovernanceForExport(projectId: string) {
    const project = await this.assertProjectAccess(projectId);
    const raw = project.agentGovernanceContent;
    if (!raw?.trim()) {
      return synthesizeExportGovernanceScaffold(project);
    }

    const filesBefore = parseAgentGovernanceScaffold(raw)?.files.length ?? 0;
    this.logger.debug(
      `[agent-gov] getAgentGovernanceForExport start projectId=${projectId} rawLen=${raw.length} filesBefore=${filesBefore}`,
    );

    const exportScaffold = reconcileExportScaffold(project, { throwIfMissing: true });
    if (!exportScaffold) {
      throw new BadRequestException("El scaffold de gobernanza no contiene archivos válidos.");
    }

    this.logger.debug(
      `[agent-gov] getAgentGovernanceForExport done projectId=${projectId} filesAfter=${exportScaffold.files.length} readOnly=true`,
    );

    return exportScaffold;
  }

  async generateTasks(projectId: string, gapsFeedback?: string | null) {
    const project = await this.assertProjectAccess(projectId);

    let navigationMap: string | undefined;
    const theforgeId = (project as Project & { theforgeProjectId?: string | null }).theforgeProjectId;
    if (theforgeId) {
      navigationMap = await this.fetchNavigationMap(theforgeId).catch(() => undefined);
    }

    const mdd = this.constitutionMarkdown(project);
    const coordinates = await this.buildTasksCoordinatesContext(
      projectId,
      project,
      mdd,
      navigationMap,
    );

    const gfOpts = this.greenfieldGenerateOptions(project);
    const taskOpts = {
      navigationMap,
      specContent: project.specContent,
      userStoriesContent: project.userStoriesContent,
      apiContractsContent: project.apiContractsContent,
      logicFlowsContent: project.logicFlowsContent,
      infraContent: project.infraContent,
      gapsFeedback,
      fileCoordinatesContext: coordinates.block,
      coordinatesMode: coordinates.coordinatesMode,
      ...gfOpts,
    };

    const tasksContent = cleanDocumentContent(
      await this.ai.generateTasks(mdd, project.blueprintContent, taskOpts),
    );

    const updated = await this.update(projectId, { tasksContent });

    if (isBrownfieldCapable(theforgeId)) {
      void this.planValidation.validateProjectChangePlan(projectId).catch((e) =>
        this.logger.warn(
          `[plan-validation] post-generateTasks failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }

    return updated;
  }

  /**
   * Arma contexto determinista para tasks con coordenadas (ChangeScope, resolve-change, hints).
   */
  private async buildTasksCoordinatesContext(
    projectId: string,
    project: Project & { stages?: Stage[] },
    mddMarkdown: string,
    navigationMap?: string,
  ): Promise<{ block: string; coordinatesMode: boolean }> {
    const stage = pickPrimaryStage(project.stages ?? []);
    const changeScope = parseChangeScopeFromLegacyState(stage?.legacyChangeState);

    const descriptions: string[] = [];
    if (changeScope?.description?.trim()) {
      descriptions.push(changeScope.description.trim());
    } else {
      descriptions.push(...extractMddCapabilityLines(mddMarkdown, 4));
    }

    const resolveResults: Array<{ description: string; result: Awaited<ReturnType<ResolveChangeToFilesService["resolve"]>> }> = [];
    const theforgeId = (project as Project & { theforgeProjectId?: string | null }).theforgeProjectId;
    if (theforgeId && descriptions.length > 0) {
      await Promise.allSettled(
        descriptions.slice(0, 4).map(async (description) => {
          const result = await this.resolveChangeToFiles.resolve({
            projectId,
            description,
            stageId: stage?.id,
          });
          if (result.suggestedFiles.length || result.affectedRoutes.length) {
            resolveResults.push({ description, result });
          }
        }),
      );
    }

    return buildTasksCoordinatesPromptBlock({
      navigationMapMarkdown: navigationMap,
      changeScope: changeScope ?? undefined,
      resolveResults,
      architectureMarkdown: project.architectureContent,
      mddMarkdown,
    });
  }

  /**
   * Obtiene el navigation map desde Ariadne MCP para enriquecer Tasks.
   */
  private async fetchNavigationMap(theforgeId: string): Promise<string | undefined> {
    try {
      const content = await this.theforge.fetchNavigationMap(theforgeId);
      if (!content || content.length < 200) return undefined;
      return content.slice(0, 6000);
    } catch {
      return undefined;
    }
  }

  async generateArchitecturePreview(projectId: string): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    const content = await this.ai.generateArchitecture(
      this.constitutionMarkdown(project),
      project.blueprintContent,
    );
    return { content: cleanDocumentContent(content) };
  }

  async generateArchitecture(projectId: string, gapsFeedback?: string | null) {
    const project = await this.assertProjectAccess(projectId);
    const mdd = this.constitutionMarkdown(project);
    const gfOpts = this.greenfieldGenerateOptions(project);
    const content = cleanDocumentContent(
      await this.ai.generateArchitecture(mdd, project.blueprintContent, {
        ...gfOpts,
        gapsFeedback,
      }),
    );

    return this.update(projectId, { architectureContent: content });
  }

  async generateUseCasesPreview(projectId: string): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    const content = await this.ai.generateUseCases(this.constitutionMarkdown(project), project.specContent);
    return { content: cleanDocumentContent(content) };
  }

  async generateUseCases(projectId: string) {
    const project = await this.assertProjectAccess(projectId);
    const content = await this.ai.generateUseCases(this.constitutionMarkdown(project), project.specContent);
    return this.update(projectId, { useCasesContent: cleanDocumentContent(content) });
  }

  async generateUserStoriesPreview(projectId: string): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    const intOpts = await this.buildIntegrationGenerateOptions(projectId);
    const content = await this.ai.generateUserStories(
      this.constitutionMarkdown(project),
      project.specContent,
      project.useCasesContent,
      intOpts,
    );
    const appendix = buildHandoffUserStoriesAppendix(intOpts?.integrationHandoffItems ?? []);
    return { content: cleanDocumentContent(content + appendix) };
  }

  async generateUserStories(projectId: string) {
    const project = await this.assertProjectAccess(projectId);
    const intOpts = await this.buildIntegrationGenerateOptions(projectId);
    const content = await this.ai.generateUserStories(
      this.constitutionMarkdown(project),
      project.specContent,
      project.useCasesContent,
      intOpts,
    );
    const appendix = buildHandoffUserStoriesAppendix(intOpts?.integrationHandoffItems ?? []);
    return this.update(projectId, { userStoriesContent: cleanDocumentContent(content + appendix) });
  }

  private async buildIntegrationGenerateOptions(projectId: string): Promise<LegacyGenerateOptions | undefined> {
    const ctx = await this.projectIntegration.resolvePromptContext(projectId, null);
    if (!ctx.externalBlock && !ctx.handoffForNew.length) return undefined;
    return {
      ...(ctx.externalBlock ? { externalLegacyContextBlock: ctx.externalBlock } : {}),
      ...(ctx.handoffForNew.length ? { integrationHandoffItems: ctx.handoffForNew } : {}),
    };
  }

  /** Pre-extrae entidades del MDD §3 y las agrega como texto literal en el prompt para la IA. */
  private enrichMddWithEntities(mddContent: string): string {
    const section3 = extractSection(
      mddContent,
      /^#+\s*(?:3\.\s*)?(?:modelo\s+de\s+datos|datos\s*\/\s*entidades)/im,
    );
    const mddEntities = extractEntities(section3);
    const entityList = Array.from(mddEntities).sort().join(", ");
    if (!entityList) return mddContent;
    return mddContent +
`
**LISTA EXACTA DE ENTIDADES DEL MDD §3 (extraídas automáticamente del SQL):** ${entityList}

CADA entidad DEBE aparecer en su PROPIA LÍNEA con cabecera ### o viñeta - en la sección "### 2. Persistencia y datos".
Ejemplo CORRECTO:
### developers
### users
### properties

Ejemplo INCORRECTO (NO detectado automáticamente):
developers
users
properties

PROHIBIDO escribir los nombres como texto plano suelto. DEBEN ser cabeceras ### o viñetas -. NO omitas ninguna.
`;
  }

  /** Pre-extrae endpoints del MDD §4 para el prompt de Contratos API. */
  private enrichMddWithApiEndpoints(mddContent: string): string {
    const endpoints = extractMddSection4Endpoints(mddContent);
    if (endpoints.length === 0) return mddContent;
    const list = endpoints.map((ep) => `${ep.method} ${ep.path}`).join("\n- ");
    return (
      mddContent +
      `

**LISTA EXACTA DE ENDPOINTS MDD §4 (extraídos automáticamente):**
- ${list}

CADA endpoint DEBE tener EXACTAMENTE UNA fila en la tabla markdown del documento (columnas Método | Ruta | …).
Usa la misma ruta que el MDD (puedes usar \`:id\` o \`{id}\` en path params). NO omitas ninguno. NO inventes rutas que no estén en esta lista salvo /health si ya figura arriba.
`
    );
  }

  async generateBlueprintPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    const mddContent = this.constitutionMarkdown(project);
    const enrichedMdd = this.enrichMddWithEntities(mddContent);
    const legacyOpts = await this.resolveLegacyGenerateOptions(project);
    const content = await this.ai.generateBlueprint(enrichedMdd, gapsFeedback, legacyOpts);
    return { content: cleanDocumentContent(content) };
  }

  async generateBlueprint(projectId: string, gapsFeedback?: string | null) {
    const project = await this.assertProjectAccess(projectId);
    const mddContent = this.constitutionMarkdown(project);
    const enrichedMdd = this.enrichMddWithEntities(mddContent);
    const legacyOpts = await this.resolveLegacyGenerateOptions(project);
    let blueprintContent = await this.ai.generateBlueprint(enrichedMdd, gapsFeedback, legacyOpts);
    blueprintContent = cleanDocumentContent(blueprintContent);

    // GUARD: Si gapsFeedback provocó un resultado vacío/corto, reintentar SIN gaps
    if (gapsFeedback && blueprintContent.length < 80) {
      this.logger.warn(`[Blueprint] Resultado vacío/corto (${blueprintContent.length} chars) con gapsFeedback — reintentando sin gaps`);
      blueprintContent = await this.ai.generateBlueprint(enrichedMdd, null, legacyOpts);
      blueprintContent = cleanDocumentContent(blueprintContent);
    }

    // GUARD: No persistir si sigue vacío — preservar el Blueprint anterior
    if (blueprintContent.length < 80) {
      this.logger.error(`[Blueprint] No se pudo generar contenido válido — preservando Blueprint anterior`);
      throw new BadRequestException("No se pudo generar el Blueprint. Intenta de nuevo.");
    }

    // Verificación multi-capa + un reintento LLM (siempre, aunque venga gapsFeedback del Workshop).
    let qualityRetried = false;
    let checks = runBlueprintQualityChecks(mddContent, blueprintContent);
    let allGaps = collectBlueprintQualityGaps(checks);

    if (allGaps.length > 0 && !qualityRetried) {
      qualityRetried = true;
      const internalFeedback = buildBlueprintQualityRetryFeedback(checks);
      const combinedFeedback = [gapsFeedback?.trim(), internalFeedback].filter(Boolean).join("\n\n");
      this.logger.warn(
        `[Blueprint] Calidad insuficiente (${checks.entity.gaps.length} entidades, ${checks.section.gaps.length} secciones, ` +
          `${checks.generalTable.gaps.length} tablaGral, ${checks.spanish.gaps.length} español, ` +
          `${checks.selfContained.gaps.length} autocontenido) — reintentando con feedback`,
      );
      blueprintContent = await this.ai.generateBlueprint(enrichedMdd, combinedFeedback, legacyOpts);
      blueprintContent = cleanDocumentContent(blueprintContent);
      checks = runBlueprintQualityChecks(mddContent, blueprintContent);
      allGaps = collectBlueprintQualityGaps(checks);
    }

    blueprintContent = repairBlueprintProgrammaticGaps(mddContent, blueprintContent);

    // Anexar §9 UI Design System (§8 queda libre para checklist del prompt).
    blueprintContent = await enrichBlueprintWithUiDesignSystem(
      mddContent,
      blueprintContent,
      await this.getUiResolver(),
      {
        pantallasContent: project.uiScreensContent,
        apiContractsContent: project.apiContractsContent,
      },
    );

    blueprintContent = repairBlueprintProgrammaticGaps(mddContent, blueprintContent);

    const postGenCheck = this.conformance.checkBlueprint(mddContent, blueprintContent);
    if (!postGenCheck.ok) {
      const gapSummary = postGenCheck.gaps.slice(0, 6).join("; ");
      this.logger.warn(`[Blueprint] Post-generation conformance gaps: ${gapSummary}`);
      await this.changeLog
        .log(projectId, "blueprintContent", `[conformance-recheck] ${gapSummary}`)
        .catch(() => {});
    }

    return this.update(projectId, { blueprintContent });
  }

  async generateApiContractsPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    this.assertBlueprintCoversMddDataModel(project);

    const mainStage = project.stages?.[0];
    const brdContent = mainStage?.brdContent ?? undefined;
    const legacyOpts = await this.resolveLegacyGenerateOptions(project);
    const content = await this.ai.generateApiContracts(
      this.enrichMddWithApiEndpoints(this.constitutionMarkdown(project)),
      project.blueprintContent,
      gapsFeedback,
      brdContent,
      legacyOpts,
    );
    return { content: cleanDocumentContent(content) };
  }

  async generateInfraPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    const project = await this.assertProjectAccess(projectId);
    const legacyOpts = await this.resolveLegacyGenerateOptions(project);
    const content = await this.ai.generateInfra(
      this.constitutionMarkdown(project),
      project.blueprintContent,
      gapsFeedback,
      legacyOpts,
    );
    return { content: cleanDocumentContent(content) };
  }

  async generateApiContracts(projectId: string, gapsFeedback?: string | null) {
    const project = await this.assertProjectAccess(projectId);
    this.assertBlueprintCoversMddDataModel(project);

    const mainStage = project.stages?.[0];
    const brdContent = mainStage?.brdContent ?? undefined;
    const mddContent = this.constitutionMarkdown(project);
    const enrichedMdd = this.enrichMddWithApiEndpoints(mddContent);
    const legacyOpts = {
      ...(await this.resolveLegacyGenerateOptions(project)),
      ...this.greenfieldGenerateOptions(project),
    };

    let apiContent = await this.ai.generateApiContracts(
      enrichedMdd,
      project.blueprintContent,
      gapsFeedback,
      brdContent,
      legacyOpts,
    );
    apiContent = cleanDocumentContent(apiContent);

    if (gapsFeedback && apiContent.length < 80) {
      this.logger.warn(
        `[API] Resultado vacío/corto (${apiContent.length} chars) con gapsFeedback — reintentando sin gaps`,
      );
      apiContent = cleanDocumentContent(
        await this.ai.generateApiContracts(
          enrichedMdd,
          project.blueprintContent,
          null,
          brdContent,
          legacyOpts,
        ),
      );
    }

    if (apiContent.length < 80) {
      throw new BadRequestException("No se pudo generar Contratos API. Intenta de nuevo.");
    }

    let qualityRetried = false;
    let apiCheck = runApiConformanceCheck(mddContent, apiContent);
    if (!apiCheck.ok && !qualityRetried) {
      qualityRetried = true;
      const internalFeedback = buildApiRetryFeedback(apiCheck);
      const combinedFeedback = [gapsFeedback?.trim(), internalFeedback].filter(Boolean).join("\n\n");
      this.logger.warn(
        `[API] Conformidad insuficiente (${apiCheck.missingInApi.length} faltantes, ${apiCheck.extraInApi.length} extra) — reintentando`,
      );
      apiContent = cleanDocumentContent(
        await this.ai.generateApiContracts(
          enrichedMdd,
          project.blueprintContent,
          combinedFeedback,
          brdContent,
          legacyOpts,
        ),
      );
      apiCheck = runApiConformanceCheck(mddContent, apiContent);
    }

    apiContent = repairApiProgrammaticGaps(mddContent, apiContent);

    const postCheck = this.conformance.checkApi(mddContent, apiContent);
    if (!postCheck.ok) {
      const gapSummary = [...postCheck.missingInApi, ...postCheck.extraInApi].slice(0, 6).join("; ");
      this.logger.warn(`[API] Post-generation conformance gaps: ${gapSummary}`);
      await this.changeLog
        .log(projectId, "apiContractsContent", `[conformance-recheck] ${gapSummary}`)
        .catch(() => {});
    }

    return this.update(projectId, { apiContractsContent: apiContent });
  }

  async generateLogicFlows(projectId: string, gapsFeedback?: string | null) {
    const project = await this.assertProjectAccess(projectId);
    const legacyOpts = await this.resolveLegacyGenerateOptions(project);
    const mdd = this.constitutionMarkdown(project);
    let content = await this.ai.generateLogicFlows(mdd, gapsFeedback, legacyOpts);
    let cleaned = cleanDocumentContent(content);

    let qualityRetried = false;
    let lfCheck = this.conformance.checkLogicFlows(mdd, cleaned);
    if (!lfCheck.ok && !qualityRetried) {
      qualityRetried = true;
      const internalFeedback = lfCheck.gaps.join("; ");
      const combinedFeedback = [gapsFeedback?.trim(), internalFeedback].filter(Boolean).join("\n\n");
      this.logger.warn(`[Flujos] Conformidad insuficiente — reintentando: ${internalFeedback.slice(0, 200)}`);
      cleaned = cleanDocumentContent(await this.ai.generateLogicFlows(mdd, combinedFeedback, legacyOpts));
      lfCheck = this.conformance.checkLogicFlows(mdd, cleaned);
    }

    if ((project as { projectType?: string }).projectType === "LEGACY") {
      await this.persistLegacyLogicFlowsCoverageDebug(projectId, project, cleaned, legacyOpts);
    }

    const postCheck = this.conformance.checkLogicFlows(mdd, cleaned);
    if (!postCheck.ok) {
      const gapSummary = postCheck.gaps.slice(0, 6).join("; ");
      this.logger.warn(`[Flujos] Post-generation conformance gaps: ${gapSummary}`);
      await this.changeLog
        .log(projectId, "logicFlowsContent", `[conformance-recheck] ${gapSummary}`)
        .catch(() => {});
    }

    return this.update(projectId, { logicFlowsContent: cleaned });
  }

  /** Parchea el MDD de la etapa según feedback de un documentation gap (reconciliación parcial). */
  async patchMddFromGapFeedback(
    projectId: string,
    stageId: string,
    gapsFeedback: string,
  ): Promise<void> {
    const project = await this.assertProjectAccess(projectId);
    const stage = project.stages.find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException("Etapa no encontrada");

    const currentMdd = (stage.mddContent ?? "").trim();
    if (!currentMdd) {
      throw new BadRequestException("MDD vacío: no se puede aplicar parche desde gap");
    }

    const patched = await this.ai.patchMddFromGapFeedback(currentMdd, gapsFeedback);
    if (!patched?.trim()) {
      throw new BadRequestException("Parche MDD inválido o vacío");
    }

    const enforced = enforceMddGovernancePatternsOnPersist(patched, stage.mddContent);
    const result = await this.mddUpdatePipeline.process(
      enforced.markdown,
      this.buildSemaphoreBase(project),
      { projectId, stageId },
    );
    if (!result.ok) {
      throw new BadRequestException({
        code: result.code,
        message: result.message,
      });
    }

    await this.prisma.stage.update({
      where: { id: stageId },
      data: {
        mddContent: result.sanitizedMdd,
        status: result.status,
        precisionScore: result.precisionScore,
      },
    });
    await this.changeLog.log(projectId, "mddContent", result.sanitizedMdd);
    await this.estimationRecalc.recalcAndUpsert(stageId, {
      mddContent: result.sanitizedMdd,
      infraContent: project.infraContent ?? null,
      status: result.status,
    });
  }

  async generateInfra(projectId: string, gapsFeedback?: string | null) {
    const project = await this.assertProjectAccess(projectId);
    const legacyOpts = await this.resolveLegacyGenerateOptions(project);
    const mdd = this.constitutionMarkdown(project);
    let content = await this.ai.generateInfra(
      mdd,
      project.blueprintContent,
      gapsFeedback,
      legacyOpts,
    );
    let cleaned = cleanDocumentContent(content);

    let qualityRetried = false;
    let infraCheck = this.conformance.checkInfra(mdd, cleaned);
    if (!infraCheck.ok && !qualityRetried) {
      qualityRetried = true;
      const internalFeedback = infraCheck.gaps.join("; ");
      const combinedFeedback = [gapsFeedback?.trim(), internalFeedback].filter(Boolean).join("\n\n");
      this.logger.warn(`[Infra] Conformidad insuficiente — reintentando: ${internalFeedback.slice(0, 200)}`);
      cleaned = cleanDocumentContent(
        await this.ai.generateInfra(mdd, project.blueprintContent, combinedFeedback, legacyOpts),
      );
      infraCheck = this.conformance.checkInfra(mdd, cleaned);
    }

    const postCheck = this.conformance.checkInfra(mdd, cleaned);
    if (!postCheck.ok) {
      const gapSummary = postCheck.gaps.slice(0, 6).join("; ");
      this.logger.warn(`[Infra] Post-generation conformance gaps: ${gapSummary}`);
      await this.changeLog
        .log(projectId, "infraContent", `[conformance-recheck] ${gapSummary}`)
        .catch(() => {});
    }

    return this.update(projectId, { infraContent: cleaned });
  }

  /** Executive Vision Deck — genera JSON de presentación ejecutiva visual. */
  async generateEVD(projectId: string): Promise<void> {
    const project = await this.assertProjectAccess(projectId);
    const primaryStage = pickPrimaryStage(project.stages);

    const evdJsonStr = await this.ai.generateEVDJSON({
      mddContent: primaryStage?.mddContent ?? null,
      specContent: project.specContent,
      benchmarkContent: project.dbgaContent,
      blueprintContent: project.blueprintContent,
    });

    // Strip markdown code fences that LLM sometimes wraps JSON in
    const cleanedJson = evdJsonStr
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const deck = typeof parsed === "string" ? JSON.parse(parsed) : parsed;

    // Repair Mermaid syntax in diagram slides (auto-close unclosed blocks, fix labels, etc.)
    if (deck?.slides && Array.isArray(deck.slides)) {
      for (const slide of deck.slides) {
        if (slide.type === "process_flow" && slide.diagramData?.code) {
          const { normalizeMermaidDiagramBody } = await import("@theforge/shared-types");
          slide.diagramData.code = normalizeMermaidDiagramBody(slide.diagramData.code);
        }
      }
    }

    // Visual Stylist: generate background + illustration images if image model is configured
    if (deck?.slides && Array.isArray(deck.slides) && project.userId) {
      try {
        const brandingColors = {
          primary: deck.branding?.primaryColor ?? "#2563EB",
          secondary: deck.branding?.secondaryColor ?? "#1E40AF",
          accent: deck.branding?.accentColor ?? "#3B82F6",
        };

        const imageResults = await this.visualStylist.generateAllImages(
          deck.slides.map((s: { type: string; title: string; body?: string; subtitle?: string }) => ({
            type: s.type,
            title: s.title,
            body: s.body ?? s.subtitle ?? "",
          })),
          brandingColors,
          project.userId,
        );

        for (let i = 0; i < deck.slides.length; i++) {
          const result = imageResults.get(i);
          if (result) {
            if (result.backgroundB64) deck.slides[i].backgroundB64 = result.backgroundB64;
            if (result.illustrationB64) deck.slides[i].illustrationB64 = result.illustrationB64;
            if (result.visualStyle) deck.slides[i].visualStyle = result.visualStyle;
          }
        }
      } catch (err) {
        this.logger.warn(`Visual Stylist image generation failed (proceeding without images): ${err}`);
      }
    }

    const evdContent = JSON.stringify(deck, null, 2);
    this.logger.log(`[EVD] Persisting deck with ${deck.slides?.length ?? 0} slides, ${evdContent.length} chars`);

    await this.update(projectId, { evdContent });
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
    const p = await this.assertProjectAccess(projectId);
    const mdd = this.constitutionMarkdown(p);

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
    const p = await this.assertProjectAccess(projectId);
    const doc =
      deliverable === "blueprint"
        ? p.blueprintContent
        : deliverable === "api"
          ? p.apiContractsContent
          : deliverable === "logicFlows"
            ? p.logicFlowsContent
            : p.infraContent;
    return this.ai.verifyDeliverable(this.constitutionMarkdown(p), doc ?? "", deliverable);
  }

  /**
   * Genera BRD desde `Project.dbgaContent` (greenfield). LEGACY debe usar
   * `POST …/legacy/suggest-brd-from-codebase-doc`. (To-Be eliminado del sistema.)
   */
  async suggestBrdFromDbga(
    projectId: string,
    opts?: { stageId?: string | null },
  ): Promise<{ brdContent: string; stageId: string }> {
    const project = await this.assertProjectAccess(projectId);
    if (project.projectType === "LEGACY") {
      throw new BadRequestException(
        "En proyectos legacy usa POST …/legacy/suggest-brd-from-codebase-doc (documentación Ariadne).",
      );
    }
    const dbga = String(project.dbgaContent ?? "").trim();
    const phase0 = String(project.phase0SummaryContent ?? "").trim();
    const effectiveDbga = dbga.length >= 300 ? dbga : phase0;
    if (effectiveDbga.length < 300) {
      throw new BadRequestException(
        "Se requiere DBGA en el proyecto (mín. ~300 caracteres). Genera el benchmark en el Paso 0 o pégalo en el proyecto.",
      );
    }
    const sid = opts?.stageId?.trim();
    const stage: StageWithEst | undefined =
      (sid ? project.stages.find((s) => s.id === sid) : undefined) ||
      pickPrimaryStage(project.stages as StageWithEst[]);
    if (!stage?.id) {
      throw new BadRequestException("No hay etapa para persistir BRD.");
    }
    const { text: dbgaForPrompt, truncated: dbgaTruncated } = truncateSourceDocForBrdPrompt(effectiveDbga);

    const brdPromptBase = buildBrdUserPrompt({
      mode: "greenfield-from-dbga",
      sourceLabel: "DBGA",
      sourceDocument: dbgaForPrompt,
    });

    let brd = "";
    let lastFailure: BrdExtractFailure = "no_delimiter";
    let lastMermaidHint = "";
    let lastRawLength = 0;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const formatReminder =
        attempt > 1
          ? buildBrdGenerationRetryReminder({
              delimiterRetry: !lastMermaidHint,
              mermaidRetry: Boolean(lastMermaidHint),
              mermaidHint: lastMermaidHint || undefined,
            })
          : "";
      const raw = await this.ai.generateResponse(brdPromptBase + formatReminder, [], {
        systemPrompt: BRD_GENERATION_SYSTEM,
      });
      lastRawLength = (raw ?? "").length;
      const extracted = extractBrdFromLlmResponse(raw ?? "");
      if (!extracted.ok) {
        lastFailure = extracted.failure;
        lastMermaidHint = "";
        if (attempt < 2) {
          console.warn(
            `[suggestBrdFromDbga] Intento BRD ${attempt}/2: ${extracted.failure} (raw ~${lastRawLength} chars), reintentando...`,
          );
        }
        continue;
      }
      const mermaidVal = validateBrdMermaidOutput(extracted.content);
      if (!mermaidVal.ok) {
        lastMermaidHint = mermaidVal.hint;
        if (attempt < 2) {
          console.warn(
            `[suggestBrdFromDbga] Intento BRD ${attempt}/2: Mermaid inválido (${mermaidVal.hint}), reintentando...`,
          );
        }
        continue;
      }
      brd = cleanDocumentContent(extracted.content);
      break;
    }
    if (!brd) {
      throw new BadRequestException(
        brdGenerationErrorMessage(lastFailure, {
          dbgaTruncated,
          rawLength: lastRawLength,
        }) +
          (lastMermaidHint ? ` Diagramas §4: ${lastMermaidHint}.` : ""),
      );
    }

    await this.prisma.stage.update({
      where: { id: stage.id },
      data: { brdContent: brd },
    });
    return { brdContent: brd, stageId: stage.id };
  }

  /** Notifica a Hermes Agent que el proyecto está listo para desarrollo via webhook proxy. */
  async launchHermes(projectId: string) {
    const project = await this.findOne(projectId);
    if (!project) throw new NotFoundException("Proyecto no encontrado");

    const webhookUrl = process.env.HERMES_WEBHOOK_URL?.trim();
    const apiKey = process.env.HERMES_API_KEY?.trim();
    if (!webhookUrl || !apiKey) {
      throw new BadRequestException(
        "HERMES_WEBHOOK_URL y HERMES_API_KEY no están configurados",
      );
    }

    const stages = (project as { stages?: StageWithEst[] }).stages ?? [];
    const projectWithStages = { ...(project as Project), stages };
    const primaryStage = pickPrimaryStage(stages);
    const unified = buildUnifiedHandoff(
      projectWithStages,
      loadConsumptionGuideMarkdown(
        specKitFeatureDir(primaryStage?.ordinal ?? 1, project.name),
      ),
    );
    const sddBundle = this.sddIntegration.buildHermesSddPayload(projectWithStages);

    const payload = {
      event_type: "project.ready",
      project: {
        id: project.id,
        name: project.name,
        type: project.projectType,
        sessionId: null as string | null,
      },
      sddBundle,
      implementHandoff: {
        readme: "IMPLEMENT.md",
        consumptionGuide: "THEFORGE-DOC-CONSUMPTION-GUIDE.md",
        layout: unified.layout,
        pathMap: unified.pathMap,
        governancePresent: unified.governancePresent,
        specKitLayout: sddBundle.featureDir,
        fileHashes: sddBundle.files.map((f) => ({ path: f.path, sha256: f.sha256, size: f.size })),
        cliFallback: sddBundle.cliFallback,
      },
    };

    // Buscar la sesión activa más reciente para incluir sessionId
    try {
      const lastSession = await this.prisma.session.findFirst({
        where: { projectId: project.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (lastSession) payload.project.sessionId = lastSession.id;
    } catch {
      // sessionId no crítico
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Hermes webhook respondió ${response.status}: ${text}`);
    }

    return { success: true, status: response.status };
  }
}
