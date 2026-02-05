import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Status } from "@the-forge/database";
import type { Prisma } from "@the-forge/database";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SemaphoreService } from "../engine/semaphore.service.js";
import { CostCalculatorService } from "../engine/cost-calculator.service.js";
import { normalizeMddContent, extractTechnicalMetadataTags } from "../engine/mdd-markdown-parser.js";
import { preRenderMddSanity, sanitizeMermaidInDraft } from "../engine/mdd-pre-render.js";
import { parseInfraFixedHours } from "../engine/cost-calculator.service.js";
import type { ApiConformanceResult, ConformanceResult } from "../engine/conformance.service.js";
import { ConformanceService } from "../engine/conformance.service.js";
import { AiService } from "../ai/ai.service.js";
import { DiscoveryService } from "../ai/discovery.service.js";
import { ScraperService } from "../scraper/scraper.service.js";
import { resolveUrls } from "../scraper/url-utils.js";
import {
  createProjectSchema,
  updateProjectSchema,
  type UpdateProjectDto,
} from "@the-forge/shared-types";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly semaphore: SemaphoreService,
    private readonly costCalculator: CostCalculatorService,
    private readonly conformance: ConformanceService,
    private readonly ai: AiService,
    private readonly discovery: DiscoveryService,
    private readonly scraper: ScraperService,
  ) { }

  async create(data: { name: string; hasUxTeam?: boolean }) {
    const parsed = createProjectSchema.parse(data);
    return this.prisma.project.create({
      data: {
        name: parsed.name,
        hasUxTeam: parsed.hasUxTeam ?? false,
      },
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { estimation: true },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { sessions: true, estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async update(id: string, data: UpdateProjectDto) {
    const parsed = updateProjectSchema.partial().parse(data);
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Project not found");

    const updatePayload: Prisma.ProjectUpdateInput = {
      ...parsed,
      figmaMapping:
        parsed.figmaMapping === null
          ? undefined
          : (parsed.figmaMapping as Prisma.InputJsonValue),
    };
    if (parsed.uxUiGuideContent !== undefined) {
      updatePayload.uxUiGuideContent = parsed.uxUiGuideContent;
    }

    const mddContentForRecalc = parsed.mddContent ?? existing.mddContent ?? null;
    const infraContentForRecalc = parsed.infraContent ?? existing.infraContent ?? null;

    let effectiveMddForRecalc = mddContentForRecalc;
    if (parsed.mddContent !== undefined && parsed.mddContent !== null) {
      const mddContent = parsed.mddContent;
      const sanity = preRenderMddSanity(mddContent);
      if (!sanity.ok) {
        throw new BadRequestException({
          code: sanity.code,
          message: sanity.message ?? "Error de validación del MDD",
        });
      }
      const sanitizedDraft = sanitizeMermaidInDraft(mddContent);
      updatePayload.mddContent = sanitizedDraft;
      effectiveMddForRecalc = sanitizedDraft;
      const normalized = normalizeMddContent(sanitizedDraft);
      const contentForSemaphore = JSON.stringify(normalized);
      const { status, precisionScore } = this.semaphore.evaluate(
        contentForSemaphore,
        existing.hasUxTeam,
      );
      updatePayload.status = status;
      updatePayload.precisionScore = precisionScore;
    }

    if (effectiveMddForRecalc != null && (parsed.mddContent !== undefined || parsed.infraContent !== undefined)) {
      const normalized = normalizeMddContent(effectiveMddForRecalc);
      const status = (updatePayload.status as Status) ?? existing.status;
      const entityCount = normalized.db_entities?.length ?? 0;
      const screenCount = normalized.screens?.length ?? 0;
      const extraEndpointCount = normalized.extra_endpoints ?? 0;
      const metadataTags = extractTechnicalMetadataTags(effectiveMddForRecalc);
      const infraFixedHours = parseInfraFixedHours(infraContentForRecalc);

      const { totalHours, totalMxn, teamStructure } = this.costCalculator.calculate({
        entityCount,
        screenCount,
        extraEndpointCount,
        metadataTags,
        infraFixedHours,
        status,
      });
      await this.prisma.estimation.upsert({
        where: { projectId: id },
        create: {
          projectId: id,
          totalHours,
          totalMxn,
          teamStructure: teamStructure as object,
        },
        update: {
          totalHours,
          totalMxn,
          teamStructure: teamStructure as object,
        },
      });
    }

    return this.prisma.project.update({
      where: { id },
      data: updatePayload,
      include: { estimation: true },
    });
  }

  async remove(id: string) {
    // ArchitecturalPreference no tiene FK con Project en el schema → borrar explícito para no dejar huérfanos
    await this.prisma.architecturalPreference.deleteMany({ where: { projectId: id } });
    await this.prisma.project.delete({ where: { id } });
    return { deleted: id };
  }

  /**
   * Genera el Domain Benchmark & Gap Analysis (DBGA) a partir de la idea del usuario y opcionalmente URLs (scraping).
   * Persiste en dbgaContent.
   */
  async generateBenchmark(projectId: string, userIdea: string, urls?: string[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
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
    return this.update(projectId, { dbgaContent: dbgaContent.trim() });
  }

  /**
   * Deep research (fase 0): scraping opcional de URLs + LLM genera documento de resumen en markdown.
   * Persiste en phase0SummaryContent.
   */
  async phase0DeepResearch(
    projectId: string,
    options: { userIdea?: string; urls?: string[]; includeBenchmark?: boolean },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
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
    // Reemplazo completo (no concatenar): el resumen anterior se sobrescribe
    return this.update(projectId, { phase0SummaryContent: summary.trim() });
  }

  /**
   * Genera el Spec (SDD: what/why) desde Benchmark + phase0Summary y lo persiste en specContent.
   */
  async generateSpec(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const specContent = await this.ai.generateSpec(
      project.dbgaContent ?? "",
      project.phase0SummaryContent,
    );
    return this.update(projectId, { specContent: specContent.trim() });
  }

  /**
   * Genera el documento Tasks (breakdown) desde MDD + Blueprint y lo persiste en tasksContent.
   */
  async generateTasks(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const tasksContent = await this.ai.generateTasks(
      project.mddContent ?? "",
      project.blueprintContent,
    );
    return this.update(projectId, { tasksContent: tasksContent.trim() });
  }

  /**
   * Genera el blueprint sin persistir (HITL: vista previa). Opcional gapsFeedback para regenerar con gaps.
   */
  async generateBlueprintPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    const content = await this.ai.generateBlueprint(project.mddContent ?? "", gapsFeedback);
    return { content: content.trim() };
  }

  /**
   * Genera el blueprint a partir del MDD guardado en el proyecto y lo persiste.
   */
  async generateBlueprint(projectId: string, gapsFeedback?: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const mddContent = project.mddContent ?? "";
    const blueprintContent = await this.ai.generateBlueprint(mddContent, gapsFeedback);
    return this.update(projectId, { blueprintContent: blueprintContent.trim() });
  }

  /** Genera API contracts sin persistir (HITL). Opcional gapsFeedback para regenerar con gaps. */
  async generateApiContractsPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    const content = await this.ai.generateApiContracts(
      project.mddContent ?? "",
      project.blueprintContent,
      gapsFeedback,
    );
    return { content: content.trim() };
  }

  /** Genera Infra sin persistir (HITL). Opcional gapsFeedback para regenerar con gaps. */
  async generateInfraPreview(projectId: string, gapsFeedback?: string | null): Promise<{ content: string }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException("Project not found");
    const content = await this.ai.generateInfra(
      project.mddContent ?? "",
      project.blueprintContent,
      gapsFeedback,
    );
    return { content: content.trim() };
  }

  async generateApiContracts(projectId: string, gapsFeedback?: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const content = await this.ai.generateApiContracts(
      project.mddContent ?? "",
      project.blueprintContent,
      gapsFeedback,
    );
    return this.update(projectId, { apiContractsContent: content.trim() });
  }

  async generateLogicFlows(projectId: string, gapsFeedback?: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const content = await this.ai.generateLogicFlows(project.mddContent ?? "", gapsFeedback);
    return this.update(projectId, { logicFlowsContent: content.trim() });
  }

  async generateInfra(projectId: string, gapsFeedback?: string | null) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { estimation: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const content = await this.ai.generateInfra(
      project.mddContent ?? "",
      project.blueprintContent,
      gapsFeedback,
    );
    return this.update(projectId, { infraContent: content.trim() });
  }

  /**
   * Conformance (SDD Fase 2): verificación Blueprint/API/Flujos/Infra vs MDD.
   * Si useLlm=true, complementa heurísticas con verificación por LLM para reducir falsos positivos/negativos.
   */
  async getConformance(
    projectId: string,
    options?: { useLlm?: boolean },
  ): Promise<{
    blueprint: ConformanceResult;
    api: ApiConformanceResult;
    logicFlows: ConformanceResult;
    infra: ConformanceResult;
  }> {
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new NotFoundException("Project not found");

    const heuristic = {
      blueprint: this.conformance.checkBlueprint(p.mddContent, p.blueprintContent),
      api: this.conformance.checkApi(p.mddContent, p.apiContractsContent),
      logicFlows: this.conformance.checkLogicFlows(p.mddContent, p.logicFlowsContent),
      infra: this.conformance.checkInfra(p.mddContent, p.infraContent),
    };

    if (!options?.useLlm) return heuristic;

    const mdd = (p.mddContent ?? "").trim();
    if (mdd.length < 200) return heuristic;

    const [blueprintLlm, apiLlm, logicFlowsLlm, infraLlm] = await Promise.all([
      this.ai.conformanceCheck(mdd, (p.blueprintContent ?? "").trim(), "blueprint"),
      this.ai.conformanceCheck(mdd, (p.apiContractsContent ?? "").trim(), "api"),
      this.ai.conformanceCheck(mdd, (p.logicFlowsContent ?? "").trim(), "logicFlows"),
      this.ai.conformanceCheck(mdd, (p.infraContent ?? "").trim(), "infra"),
    ]);

    return {
      blueprint: blueprintLlm.ok ? { ok: true, gaps: [] } : { ok: false, gaps: blueprintLlm.gaps },
      api: apiLlm.ok
        ? { ok: true, missingInApi: [], extraInApi: [] }
        : { ok: false, missingInApi: apiLlm.gaps, extraInApi: [] },
      logicFlows: logicFlowsLlm.ok ? { ok: true, gaps: [] } : { ok: false, gaps: logicFlowsLlm.gaps },
      infra: infraLlm.ok ? { ok: true, gaps: [] } : { ok: false, gaps: infraLlm.gaps },
    };
  }

  /**
   * Reflexión (SDD Fase 3): verifica si un entregable cumple el MDD (LLM).
   */
  async verifyDeliverable(
    projectId: string,
    deliverable: "blueprint" | "api" | "infra",
  ): Promise<string> {
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new NotFoundException("Project not found");
    const doc =
      deliverable === "blueprint"
        ? p.blueprintContent
        : deliverable === "api"
          ? p.apiContractsContent
          : p.infraContent;
    return this.ai.verifyDeliverable(p.mddContent ?? "", doc ?? "", deliverable);
  }
}
