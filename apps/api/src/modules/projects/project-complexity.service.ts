import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { ComplexityLevel } from "@theforge/database";
import { cleanDocumentContent } from "../sessions/document-content.util.js";
import { DiscoveryService } from "../ai/discovery.service.js";
import { ScraperService } from "../scraper/scraper.service.js";
import { resolveUrls } from "../scraper/url-utils.js";
import type { ComplexityPending } from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  loadAccessibleProjectWithStages,
  projectWhereForOwner,
} from "./project-access.util.js";
import { pickMddFromStages } from "./constitution-markdown.util.js";
import { ProjectsService } from "./projects.service.js";

@Injectable()
export class ProjectComplexityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly scraper: ScraperService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
  ) {}

  async generateBenchmark(projectId: string, userIdea: string, urls?: string[]) {
    await loadAccessibleProjectWithStages(this.prisma, projectId);
    const resolvedUrls = resolveUrls(urls, userIdea);
    let scrapedContext: string | undefined;
    if (resolvedUrls.length > 0) {
      console.log("[generateBenchmark] URLs a scrapear:", resolvedUrls.length, resolvedUrls);
      const pages = await this.scraper.scrapeUrls(resolvedUrls);
      const ok = pages.filter((p) => p.markdown.trim().length > 0);
      const failed = pages.filter((p) => p.error || !p.markdown.trim());
      if (failed.length > 0) {
        console.warn(
          "[generateBenchmark] URLs sin contenido o error:",
          failed.map((p) => ({ url: p.url, error: p.error })),
        );
      }
      scrapedContext = ok.map((p) => `## Referencia: ${p.url}\n\n${p.markdown}`).join("\n\n");
      console.log(
        "[generateBenchmark] Scraped context:",
        scrapedContext?.length ?? 0,
        "chars,",
        ok.length,
        "páginas OK",
      );
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
    return this.projects.update(projectId, {
      dbgaContent: cleanDocumentContent(trimmed),
      complexityPending: proposal,
    });
  }

  /**
   * Re-infiere `complexityPending` (HITL) desde DBGA / MDD / Spec ya existentes, sin re-ejecutar el stream DBGA.
   */
  async reassessComplexity(projectId: string, options?: { note?: string }) {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);

    const dbga = (project.dbgaContent ?? "").trim();
    const mdd = pickMddFromStages(project.stages).trim();
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
    return this.projects.update(projectId, { complexityPending: proposal });
  }

  /** Aplica la propuesta pendiente a `complexity` y limpia HITL (tras confirmación explícita del usuario). */
  async confirmComplexityProposal(projectId: string) {
    const row = await this.prisma.project.findFirst({
      where: projectWhereForOwner(projectId),
    });
    if (!row) throw new NotFoundException("Project not found");
    const raw = row.complexityPending;
    if (raw == null || typeof raw !== "object" || !("level" in raw)) {
      throw new BadRequestException("No hay propuesta de complejidad pendiente de confirmar.");
    }
    const level = (raw as { level: string }).level as ComplexityLevel;
    return this.projects.update(projectId, {
      complexity: level,
      clearComplexityPending: true,
    });
  }

  /** Interpreta mensajes cortos del chat del Workshop para confirmar o rechazar la propuesta HITL. */
  async tryConfirmComplexityFromChatMessage(
    projectId: string,
    message: string,
  ): Promise<{ confirmed: boolean; rejected: boolean }> {
    const row = await this.prisma.project.findFirst({
      where: projectWhereForOwner(projectId),
    });
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
      await this.projects.update(projectId, { clearComplexityPending: true });
      return { confirmed: false, rejected: true };
    }
    return { confirmed: false, rejected: false };
  }
}
