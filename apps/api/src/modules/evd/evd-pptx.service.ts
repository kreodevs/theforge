import { Injectable, Logger } from "@nestjs/common";
import type { EvdDesignTheme } from "./evd-design-system.js";
import { buildTheme } from "./evd-design-system.js";

export interface EvdSlide {
  id: string;
  type: string;
  order: number;
  title: string;
  subtitle?: string;
  speakerNotes?: string;
  bullets?: string[];
  problem?: string;
  impact?: string;
  description?: string;
  keyFeatures?: string[];
  differentiators?: string[];
  chartData?: Record<string, unknown>;
  insights?: string[];
  diagramData?: { diagramType: string; code: string } | Record<string, unknown>;
  wireframeData?: Record<string, unknown>;
  milestones?: { label: string; date: string; description: string }[];
  members?: { name: string; role: string; bio: string }[];
  contactInfo?: string;
  columns?: { header: string; align?: string }[];
  rows?: string[][];
  [key: string]: unknown;
}

export interface EvdDeck {
  meta?: { title?: string; subtitle?: string; brand?: string; totalSlides?: number };
  branding?: Record<string, unknown>;
  slides: EvdSlide[];
}

@Injectable()
export class EvdPptxService {
  private readonly logger = new Logger(EvdPptxService.name);

  async generatePPTX(
    deck: EvdDeck,
    renderedCharts: Map<string, string> = new Map(),
    renderedDiagrams: Map<string, string> = new Map(),
    renderedWireframes: Map<string, string> = new Map(),
    logoBuffer?: Buffer | null,
  ): Promise<Buffer> {
    const pptxgen = (await import("pptxgenjs")).default;
    const pptx = new pptxgen();

    const theme = buildTheme(deck.branding as Record<string, unknown> | null);

    // Presentation settings
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "The Forge — Executive Vision Deck";
    pptx.company = deck.meta?.brand ?? "The Forge";
    pptx.subject = deck.meta?.title ?? "Executive Vision Deck";

    // Define master slides
    this.defineMasters(pptx, theme, logoBuffer);

    // Add slides
    for (const slide of deck.slides ?? []) {
      this.addSlide(pptx, slide, theme, renderedCharts, renderedDiagrams, renderedWireframes, logoBuffer);
    }

    const buffer = await pptx.write({ outputType: "nodebuffer" });
    return Buffer.from(buffer);
  }

  private defineMasters(pptx: ReturnType<typeof import("pptxgenjs").default>, theme: EvdDesignTheme, logoBuffer?: Buffer | null): void {
    // Cover master
    pptx.defineSlideMaster({
      title: "COVER_MASTER",
      background: {
        color: theme.colors.brandPrimary,
      },
      objects: [
        // Subtle gradient overlay via shape
        { rect: { x: 0, y: 0, w: "100%", h: "100%", fill: { color: theme.colors.brandSecondary, transparency: 60 } } },
      ],
    });

    // Content master
    pptx.defineSlideMaster({
      title: "CONTENT_MASTER",
      background: { color: theme.colors.bg },
      objects: [
        // Top brand line
        { rect: { x: 0, y: 0, w: "100%", h: 0.03, fill: { color: theme.colors.brandPrimary } } },
        // Footer
        {
          text: {
            text: "Confidential | The Forge",
            options: { x: 0.5, y: 6.9, w: 8, h: 0.4, fontSize: 8, color: theme.colors.textLight, fontFace: theme.typography.family },
          },
        },
      ],
    });
  }

  private addSlide(
    pptx: ReturnType<typeof import("pptxgenjs").default>,
    slide: EvdSlide,
    theme: EvdDesignTheme,
    charts: Map<string, string>,
    diagrams: Map<string, string>,
    wireframes: Map<string, string>,
    logoBuffer?: Buffer | null,
  ): void {
    const type = slide.type?.toLowerCase() ?? "narrative";

    switch (type) {
      case "title":
        this.coverSlide(pptx, slide, theme);
        break;
      case "executive_summary":
      case "problem_statement":
      case "solution_overview":
        this.textSlide(pptx, slide, theme, type);
        break;
      case "market_analysis":
      case "data_chart":
      case "financials":
        this.chartSlide(pptx, slide, theme, charts);
        break;
      case "architecture_diagram":
        this.diagramSlide(pptx, slide, theme, diagrams);
        break;
      case "wireframe":
        this.wireframeSlide(pptx, slide, theme, wireframes);
        break;
      case "timeline":
        this.timelineSlide(pptx, slide, theme);
        break;
      case "team":
        this.teamSlide(pptx, slide, theme);
        break;
      case "cta":
        this.ctaSlide(pptx, slide, theme);
        break;
      default:
        this.textSlide(pptx, slide, theme, type);
        break;
    }

    // Add speaker notes to the last added slide
    if (slide.speakerNotes) {
      const slides = pptx.slides;
      const lastSlide = slides[slides.length - 1];
      if (lastSlide) {
        lastSlide.addNotes(slide.speakerNotes);
      }
    }
  }

  private coverSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "COVER_MASTER" });

    s.addText(slide.title ?? "", {
      x: 1, y: 2.2, w: 11.33, h: 1.5,
      fontSize: 36, fontFace: theme.typography.family,
      color: "#FFFFFF", bold: true, align: "center",
    });

    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 1, y: 3.8, w: 11.33, h: 0.8,
        fontSize: 16, fontFace: theme.typography.family,
        color: "#FFFFFFCC", align: "center",
      });
    }
  }

  private textSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme, type: string): void {
    const s = pptx.addSlide({ masterName: "CONTENT_MASTER" });

    // Title
    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.3, w: 12.33, h: 0.8,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });

    // Brand line
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.05, w: 2, h: 0.04,
      fill: { color: theme.colors.brandPrimary },
    });

    let bodyY = 1.4;

    // Problem/impact for problem_statement
    if (type === "problem_statement") {
      if (slide.problem) {
        s.addText(slide.problem, {
          x: 0.5, y: bodyY, w: 12.33, h: 1.5,
          fontSize: theme.typography.bodySize + 2, fontFace: theme.typography.family,
          color: theme.colors.text, valign: "top",
        });
        bodyY += 1.6;
      }
      if (slide.impact) {
        s.addShape(pptx.ShapeType.roundRect, {
          x: 0.5, y: bodyY, w: 12.33, h: 0.8,
          fill: { color: theme.colors.highlight + "10" },
          line: { color: theme.colors.highlight, width: 1 },
          rectRadius: 0.1,
        });
        s.addText(`Impacto: ${slide.impact}`, {
          x: 0.7, y: bodyY + 0.1, w: 11.93, h: 0.6,
          fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
          color: theme.colors.highlight, bold: true, valign: "middle",
        });
        bodyY += 1;
      }
    }

    // Solution description
    if (type === "solution_overview" && slide.description) {
      s.addText(slide.description, {
        x: 0.5, y: bodyY, w: 12.33, h: 1,
        fontSize: theme.typography.bodySize + 2, fontFace: theme.typography.family,
        color: theme.colors.text, valign: "top",
      });
      bodyY += 1.1;
    }

    // Key features
    if (slide.keyFeatures?.length) {
      const featureText = slide.keyFeatures.map((f) => ({ text: f, options: { bullet: { code: "25CF" }, breakType: "none" as const } }));
      s.addText(featureText, {
        x: 0.5, y: bodyY, w: 12.33, h: slide.keyFeatures.length * 0.35 + 0.2,
        fontSize: theme.typography.bodySize, fontFace: theme.typography.family,
        color: theme.colors.text, lineSpacingMultiple: 1.5, valign: "top",
        paraSpaceAfter: 6,
      });
    }

    // Bullets
    if (slide.bullets?.length) {
      const bulletText = slide.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" } } }));
      s.addText(bulletText, {
        x: 0.5, y: bodyY, w: 12.33, h: slide.bullets.length * 0.4 + 0.3,
        fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
        color: theme.colors.text, lineSpacingMultiple: 1.4, valign: "top",
        paraSpaceAfter: 8,
      });
    }
  }

  private chartSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme, charts: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "CONTENT_MASTER" });

    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.3, w: 12.33, h: 0.8,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });

    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.05, w: 2, h: 0.04,
      fill: { color: theme.colors.brandPrimary },
    });

    // If we have a rendered SVG chart, embed it
    const svg = charts.get(slide.id);
    if (svg) {
      // Convert SVG to PNG for PPTX embedding
      s.addImage({ data: this.svgToDataUri(svg), x: 0.5, y: 1.3, w: 12.33, h: 5 });
    } else {
      // Fallback: render chart data as a simple table
      this.chartFallbackTable(s, slide, theme, 1.3);
    }
  }

  private chartFallbackTable(s: ReturnType<ReturnType<typeof import("pptxgenjs").default>["addSlide"]>, slide: EvdSlide, theme: EvdDesignTheme, startY: number): void {
    const chartData = slide.chartData as { labels?: string[]; datasets?: { label: string; values: number[] }[] } | undefined;
    if (!chartData?.labels?.length || !chartData.datasets?.length) return;

    const rows: string[][] = [
      ["", ...chartData.labels],
      ...chartData.datasets.map((ds) => [ds.label, ...ds.values.map(String)]),
    ];

    s.addTable(rows, {
      x: 0.5, y: startY, w: 12.33,
      fontSize: 10, fontFace: theme.typography.family,
      color: theme.colors.text,
      border: { type: "solid", pt: 0.5, color: theme.colors.border },
      colW: [3, ...chartData.labels.map(() => (11.33 / chartData.labels.length))],
      autoPage: false,
    });
  }

  private diagramSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme, diagrams: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "CONTENT_MASTER" });

    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.3, w: 12.33, h: 0.8,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });

    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.05, w: 2, h: 0.04,
      fill: { color: theme.colors.brandPrimary },
    });

    const svg = diagrams.get(slide.id);
    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 0.5, y: 1.3, w: 12.33, h: 5.2 });
    } else {
      const diagramData = slide.diagramData as { code?: string } | undefined;
      if (diagramData?.code) {
        s.addText(diagramData.code, {
          x: 0.5, y: 1.3, w: 12.33, h: 5.2,
          fontSize: 10, fontFace: "Courier New",
          color: theme.colors.text, valign: "top",
          fill: { color: theme.colors.bgSubtle },
          margin: [10, 10, 10, 10],
        });
      }
    }
  }

  private wireframeSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme, wireframes: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "CONTENT_MASTER" });

    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.3, w: 12.33, h: 0.8,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });

    const svg = wireframes.get(slide.id);
    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 1.5, y: 1.3, w: 10.33, h: 5.5 });
    }
  }

  private timelineSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "CONTENT_MASTER" });

    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.3, w: 12.33, h: 0.8,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });

    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.05, w: 2, h: 0.04,
      fill: { color: theme.colors.brandPrimary },
    });

    const milestones = slide.milestones ?? [];
    if (!milestones.length) return;

    const lineY = 3.2;
    const startX = 0.5;
    const endX = 12.83;
    const step = (endX - startX) / Math.max(milestones.length - 1, 1);

    // Timeline line
    s.addShape(pptx.ShapeType.rect, {
      x: startX, y: lineY, w: endX - startX, h: 0.04,
      fill: { color: theme.colors.brandPrimary },
    });

    milestones.forEach((m, i) => {
      const cx = startX + i * step;

      // Dot
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.15, y: lineY - 0.13, w: 0.3, h: 0.3,
        fill: { color: theme.colors.brandPrimary },
      });

      // Date above
      s.addText(m.date, {
        x: cx - 1, y: lineY - 0.9, w: 2, h: 0.4,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.brandPrimary, bold: true, align: "center",
      });

      // Label + description below
      s.addText(`${m.label}\n${m.description}`, {
        x: cx - 1, y: lineY + 0.5, w: 2, h: 1.2,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.text, align: "center", valign: "top",
        lineSpacingMultiple: 1.3,
      });
    });
  }

  private teamSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "CONTENT_MASTER" });

    s.addText(slide.title ?? "", {
      x: 0.5, y: 0.3, w: 12.33, h: 0.8,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });

    const members = slide.members ?? [];
    const cols = Math.min(members.length, 4);
    const cardW = 2.8;
    const gap = 0.3;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = (13.33 - totalW) / 2;

    members.forEach((m, i) => {
      const cx = startX + i * (cardW + gap);

      // Card
      s.addShape(pptx.ShapeType.roundRect, {
        x: cx, y: 1.5, w: cardW, h: 4,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.border, width: 1 },
        rectRadius: 0.1,
      });

      // Avatar placeholder
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx + cardW / 2 - 0.5, y: 1.8, w: 1, h: 1,
        fill: { color: theme.colors.brandPrimary + "20" },
      });

      s.addText(m.name, {
        x: cx + 0.15, y: 3, w: cardW - 0.3, h: 0.5,
        fontSize: 13, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, align: "center",
      });

      s.addText(m.role, {
        x: cx + 0.15, y: 3.45, w: cardW - 0.3, h: 0.4,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.brandPrimary, align: "center",
      });

      s.addText(m.bio, {
        x: cx + 0.15, y: 3.9, w: cardW - 0.3, h: 1.2,
        fontSize: 9, fontFace: theme.typography.family,
        color: theme.colors.textLight, align: "center", valign: "top",
        lineSpacingMultiple: 1.3,
      });
    });
  }

  private ctaSlide(pptx: ReturnType<typeof import("pptxgenjs").default>, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "COVER_MASTER" });

    s.addText(slide.title ?? "Próximos Pasos", {
      x: 1, y: 2, w: 11.33, h: 1.5,
      fontSize: 32, fontFace: theme.typography.family,
      color: "#FFFFFF", bold: true, align: "center",
    });

    if (slide.description) {
      s.addText(slide.description, {
        x: 2, y: 3.5, w: 9.33, h: 1,
        fontSize: 14, fontFace: theme.typography.family,
        color: "#FFFFFFCC", align: "center",
      });
    }

    if (slide.contactInfo) {
      s.addText(slide.contactInfo, {
        x: 3, y: 5, w: 7.33, h: 0.6,
        fontSize: 12, fontFace: theme.typography.family,
        color: "#FFFFFF99", align: "center",
      });
    }
  }

  private svgToDataUri(svg: string): string {
    const encoded = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${encoded}`;
  }
}
