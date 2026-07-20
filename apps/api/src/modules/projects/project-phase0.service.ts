import { BadRequestException, Inject, Injectable, forwardRef } from "@nestjs/common";
import { cleanDocumentContent } from "../sessions/document-content.util.js";
import { DiscoveryService } from "../ai/discovery.service.js";
import { ScraperService } from "../scraper/scraper.service.js";
import { resolveUrls } from "../scraper/url-utils.js";
import { loadAccessibleProjectWithStages } from "./project-access.util.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { ProjectsService } from "./projects.service.js";

@Injectable()
export class ProjectPhase0Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly scraper: ScraperService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
  ) {}

  async phase0DeepResearch(
    projectId: string,
    options: { userIdea?: string; urls?: string[]; includeBenchmark?: boolean },
  ) {
    const project = await loadAccessibleProjectWithStages(this.prisma, projectId);
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
    return this.projects.update(projectId, {
      phase0SummaryContent: cleanDocumentContent(summary.trim()),
    });
  }
}
