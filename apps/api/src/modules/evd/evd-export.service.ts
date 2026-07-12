import { Injectable, Logger } from "@nestjs/common";
import { EvdStorageService } from "./evd-storage.service.js";
import { EvdChartService, type EvdChartData } from "./evd-chart.service.js";
import { EvdDiagramService } from "./evd-diagram.service.js";
import { EvdPptxService, type EvdDeck } from "./evd-pptx.service.js";
import { EvdPdfService } from "./evd-pdf.service.js";

@Injectable()
export class EvdExportService {
  private readonly logger = new Logger(EvdExportService.name);

  constructor(
    private readonly storage: EvdStorageService,
    private readonly chartService: EvdChartService,
    private readonly diagramService: EvdDiagramService,
    private readonly pptxService: EvdPptxService,
    private readonly pdfService: EvdPdfService,
  ) {}

  /**
   * Render all visual assets from the deck (charts → SVG, diagrams → SVG).
   * Returns maps keyed by slide ID.
   */
  async renderAll(deck: EvdDeck): Promise<{
    charts: Map<string, string>;
    diagrams: Map<string, string>;
  }> {
    const charts = new Map<string, string>();
    const diagrams = new Map<string, string>();

    const theme = (
      await import("./evd-design-system.js")
    ).buildTheme(deck.branding as Record<string, unknown> | null);

    for (const slide of deck.slides ?? []) {
      try {
        // Charts: automations type can have chartData
        if (slide.type === "automations" && slide.chartData) {
          const svg = this.chartService.renderChartSVG(slide.chartData as unknown as EvdChartData, theme);
          charts.set(slide.id, svg);
        }

        // Diagrams: process_flow type can have diagramData with mermaid code
        if (slide.type === "process_flow") {
          const diagramData = slide.diagramData as { code?: string; diagramType?: string } | undefined;
          if (diagramData?.code) {
            const { normalizeMermaidDiagramBody } = await import("@theforge/shared-types");
            const repaired = normalizeMermaidDiagramBody(diagramData.code);
            const svg = await this.diagramService.renderMermaidSVG(repaired, theme);
            diagrams.set(slide.id, svg);
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to render visual for slide ${slide.id}: ${err}`);
      }
    }

    return { charts, diagrams };
  }

  /** Export deck to PPTX and return buffer. */
  async exportPPTX(projectId: string): Promise<Buffer> {
    const deck = await this.loadDeck(projectId);
    const { charts, diagrams } = await this.renderAll(deck);
    const logo = this.storage.loadLogo(projectId);
    const buffer = await this.pptxService.generatePPTX(deck, charts, diagrams, logo?.buffer);
    await this.storage.saveExport(projectId, "deck.pptx", buffer);
    return buffer;
  }

  /** Export deck to PDF and return buffer. */
  async exportPDF(projectId: string): Promise<Buffer> {
    const deck = await this.loadDeck(projectId);
    const { charts, diagrams } = await this.renderAll(deck);
    const buffer = await this.pdfService.generatePDF(deck, charts, diagrams);
    await this.storage.saveExport(projectId, "deck.pdf", buffer);
    return buffer;
  }

  /** Render all charts/diagrams and persist SVGs for preview. */
  async renderAndPersist(projectId: string): Promise<{ charts: number; diagrams: number }> {
    const deck = await this.loadDeck(projectId);
    const { charts, diagrams } = await this.renderAll(deck);

    for (const [id, svg] of charts) {
      await this.storage.saveAsset(projectId, `charts/${id}.svg`, Buffer.from(svg));
    }
    for (const [id, svg] of diagrams) {
      await this.storage.saveAsset(projectId, `diagrams/${id}.svg`, Buffer.from(svg));
    }

    return { charts: charts.size, diagrams: diagrams.size };
  }

  private async loadDeck(projectId: string): Promise<EvdDeck> {
    // Try DB first, then filesystem
    const fromDb = await this.storage.loadFromDb(projectId);
    if (fromDb && typeof fromDb === "object" && "slides" in fromDb) {
      return fromDb as EvdDeck;
    }

    const fromFs = this.storage.loadSlides(projectId);
    if (fromFs && typeof fromFs === "object" && "slides" in fromFs) {
      return fromFs as EvdDeck;
    }

    throw new Error(`No EVD data found for project ${projectId}. Generate the deck first.`);
  }
}
