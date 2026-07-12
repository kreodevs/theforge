import { Injectable } from "@nestjs/common";
import type PptxGenJS from "pptxgenjs";
import type { EvdDesignTheme } from "./evd-design-system.js";
import { buildTheme, lighten } from "./evd-design-system.js";

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

  async generatePPTX(
    deck: EvdDeck,
    renderedCharts: Map<string, string> = new Map(),
    renderedDiagrams: Map<string, string> = new Map(),
    renderedWireframes: Map<string, string> = new Map(),
    logoBuffer?: Buffer | null,
  ): Promise<Buffer> {
    const PptxGenJSModule = await import("pptxgenjs");
    const PptxGenJSClass = PptxGenJSModule.default as unknown as new () => PptxGenJS;
    const pptx = new PptxGenJSClass();

    const theme = buildTheme(deck.branding as Record<string, unknown> | null);

    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "The Forge — Executive Vision Deck";
    pptx.company = deck.meta?.brand ?? "The Forge";
    pptx.subject = deck.meta?.title ?? "Executive Vision Deck";

    this.defineMasters(pptx, theme, logoBuffer);

    for (const slide of deck.slides ?? []) {
      this.addSlide(pptx, slide, theme, renderedCharts, renderedDiagrams, renderedWireframes, logoBuffer);
    }

    const buffer = await pptx.write({ outputType: "nodebuffer" });
    return buffer as Buffer;
  }

  /* ── Master Slides ────────────────────────────────────────────── */

  private defineMasters(pptx: PptxGenJS, theme: EvdDesignTheme, _logoBuffer?: Buffer | null): void {
    // Cover master: dark gradient background with geometric decoration
    pptx.defineSlideMaster({
      title: "COVER_MASTER",
      background: { color: theme.colors.brandPrimary },
      objects: [
        // Diagonal accent stripe (top-right)
        { rect: { x: 8, y: -1, w: 7, h: 3.5, rotate: -15, fill: { color: theme.colors.brandAccent, transparency: 85 } } },
        // Subtle bottom accent bar
        { rect: { x: 0, y: 6.85, w: "100%", h: 0.15, fill: { color: theme.colors.highlight } } },
        // Small brand mark bottom-left
        { rect: { x: 0.6, y: 6.9, w: 0.8, h: 0.03, fill: { color: theme.colors.white, transparency: 60 } } },
      ],
    });

    // Content master: sidebar layout
    pptx.defineSlideMaster({
      title: "SIDEBAR_MASTER",
      background: { color: theme.colors.white },
      objects: [
        // Left sidebar with brand color
        { rect: { x: 0, y: 0, w: 0.35, h: "100%", fill: { color: theme.colors.brandPrimary } } },
        // Accent stripe on sidebar
        { rect: { x: 0.35, y: 0, w: 0.04, h: "100%", fill: { color: theme.colors.brandAccent } } },
        // Subtle top bar
        { rect: { x: 0.39, y: 0, w: "100%", h: 0.02, fill: { color: theme.colors.border } } },
        // Footer
        {
          text: {
            text: "Confidential",
            options: { x: 0.7, y: 6.95, w: 3, h: 0.3, fontSize: 8, color: theme.colors.textMuted, fontFace: theme.typography.family },
          },
        },
      ],
    });

    // Wide content master (for charts, diagrams — no sidebar)
    pptx.defineSlideMaster({
      title: "WIDE_MASTER",
      background: { color: theme.colors.white },
      objects: [
        // Top accent bar
        { rect: { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: theme.colors.brandPrimary } } },
        // Bottom thin line
        { rect: { x: 0.5, y: 6.9, w: 12.33, h: 0.01, fill: { color: theme.colors.border } } },
        // Footer
        {
          text: {
            text: "Confidential",
            options: { x: 0.5, y: 6.95, w: 3, h: 0.3, fontSize: 8, color: theme.colors.textMuted, fontFace: theme.typography.family },
          },
        },
      ],
    });

    // Section divider master (dark bg for section breaks)
    pptx.defineSlideMaster({
      title: "SECTION_MASTER",
      background: { color: theme.colors.brandSecondary },
      objects: [
        // Decorative circle top-right
        { rect: { x: 10, y: -0.5, w: 4, h: 4, fill: { color: theme.colors.brandAccent, transparency: 80 } } },
        // Accent bar at bottom
        { rect: { x: 0, y: 6.85, w: "100%", h: 0.04, fill: { color: theme.colors.highlight } } },
      ],
    });
  }

  /* ── Slide Router ────────────────────────────────────────────── */

  private addSlide(
    pptx: PptxGenJS,
    slide: EvdSlide,
    theme: EvdDesignTheme,
    charts: Map<string, string>,
    diagrams: Map<string, string>,
    wireframes: Map<string, string>,
    _logoBuffer?: Buffer | null,
  ): void {
    const type = slide.type?.toLowerCase() ?? "narrative";

    switch (type) {
      case "title":
        this.coverSlide(pptx, slide, theme);
        break;
      case "executive_summary":
        this.executiveSummarySlide(pptx, slide, theme);
        break;
      case "problem_statement":
        this.problemSlide(pptx, slide, theme);
        break;
      case "solution_overview":
        this.solutionSlide(pptx, slide, theme);
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
        this.defaultSlide(pptx, slide, theme);
        break;
    }

    // Speaker notes
    if (slide.speakerNotes) {
      const slides = (pptx as unknown as { slides?: PptxGenJS.Slide[] }).slides;
      const lastSlide = slides?.[slides.length - 1];
      if (lastSlide) {
        lastSlide.addNotes(slide.speakerNotes);
      }
    }
  }

  /* ── Cover Slide ────────────────────────────────────────────── */

  private coverSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "COVER_MASTER" });

    // Title — large, white, bold
    s.addText(slide.title ?? "", {
      x: 1.2, y: 1.8, w: 10.93, h: 2,
      fontSize: 44, fontFace: theme.typography.family,
      color: theme.colors.white, bold: true, align: "left",
      lineSpacingMultiple: 1.1,
    });

    // Accent line under title
    s.addShape(pptx.ShapeType.rect, {
      x: 1.2, y: 3.85, w: 2.5, h: 0.06,
      fill: { color: theme.colors.highlight },
    });

    // Subtitle
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 1.2, y: 4.15, w: 10.93, h: 0.8,
        fontSize: 18, fontFace: theme.typography.family,
        color: lighten(theme.colors.white, 0.7), align: "left",
        lineSpacingMultiple: 1.3,
      });
    }

    // Brand text bottom-left
    s.addText("Executive Vision Deck", {
      x: 1.2, y: 6.2, w: 4, h: 0.4,
      fontSize: 10, fontFace: theme.typography.family,
      color: lighten(theme.colors.white, 0.5), align: "left",
    });
  }

  /* ── Executive Summary — sidebar + 2-column layout ────────── */

  private executiveSummarySlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    const bodyY = 1.6;

    if (slide.description) {
      s.addText(slide.description, {
        x: 0.8, y: bodyY, w: 11.73, h: 1,
        fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
        color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.5,
      });
    }

    // Key features in 2-column grid
    const features = slide.keyFeatures ?? [];
    if (features.length) {
      const col1 = features.slice(0, Math.ceil(features.length / 2));
      const col2 = features.slice(Math.ceil(features.length / 2));

      const startY = bodyY + (slide.description ? 1.2 : 0);

      // "Key Features" header
      s.addText("Características Clave", {
        x: 0.8, y: startY, w: 4, h: 0.4,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });

      const renderFeatureCol = (items: string[], startX: number, colW: number) => {
        items.forEach((f, i) => {
          // Accent dot
          s.addShape(pptx.ShapeType.ellipse, {
            x: startX, y: startY + 0.55 + i * 0.55, w: 0.12, h: 0.12,
            fill: { color: theme.colors.brandAccent },
          });
          s.addText(f, {
            x: startX + 0.25, y: startY + 0.4 + i * 0.55, w: colW - 0.3, h: 0.4,
            fontSize: theme.typography.bodySize, fontFace: theme.typography.family,
            color: theme.colors.text, valign: "middle",
          });
        });
      };

      renderFeatureCol(col1, 0.8, 5.5);
      if (col2.length) renderFeatureCol(col2, 6.8, 5.5);
    }

    // Bullets at bottom
    if (slide.bullets?.length) {
      this.addBullets(slide.bullets, theme, 0.8, 4.8, 11.73, s);
    }
  }

  /* ── Problem Statement — impact highlight ──────────────────── */

  private problemSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;

    if (slide.problem) {
      s.addText(slide.problem, {
        x: 0.8, y: bodyY, w: 11.73, h: 2,
        fontSize: theme.typography.bodySize + 2, fontFace: theme.typography.family,
        color: theme.colors.text, valign: "top", lineSpacingMultiple: 1.6,
      });
      bodyY += 2.2;
    }

    // Impact box
    if (slide.impact) {
      // Background shape
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 11.73, h: 1.2,
        fill: { color: theme.colors.highlight, transparency: 90 },
        line: { color: theme.colors.highlight, width: 1.5 },
        rectRadius: 0.12,
      });
      // Left accent bar
      s.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: bodyY + 0.15, w: 0.06, h: 0.9,
        fill: { color: theme.colors.highlight },
      });
      s.addText([
        { text: "Impacto  ", options: { bold: true, fontSize: 12, color: theme.colors.highlight } },
        { text: slide.impact, options: { fontSize: 12, color: theme.colors.text } },
      ], {
        x: 1.1, y: bodyY + 0.15, w: 11.2, h: 0.9,
        fontFace: theme.typography.family, valign: "middle", lineSpacingMultiple: 1.4,
      });
      bodyY += 1.5;
    }

    // Differentiators
    if (slide.differentiators?.length) {
      s.addText("Diferenciadores", {
        x: 0.8, y: bodyY, w: 4, h: 0.35,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      this.addBullets(slide.differentiators, theme, 0.8, bodyY + 0.4, 11.73, s);
    }
  }

  /* ── Solution Overview — feature cards ─────────────────────── */

  private solutionSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;

    if (slide.description) {
      s.addText(slide.description, {
        x: 0.8, y: bodyY, w: 11.73, h: 1,
        fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
        color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.5,
      });
      bodyY += 1.2;
    }

    // Feature cards in grid
    const features = slide.keyFeatures ?? [];
    if (features.length) {
      const cols = Math.min(features.length, 3);
      const cardW = 3.6;
      const gap = 0.3;
      const totalW = cols * cardW + (cols - 1) * gap;
      const startX = 0.8 + (11.73 - totalW) / 2;

      features.slice(0, 6).forEach((f, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = startX + col * (cardW + gap);
        const cy = bodyY + row * 1.6;

        // Card background
        s.addShape(pptx.ShapeType.roundRect, {
          x: cx, y: cy, w: cardW, h: 1.3,
          fill: { color: theme.colors.bgSubtle },
          line: { color: theme.colors.border, width: 0.5 },
          rectRadius: 0.08,
        });
        // Accent top edge
        s.addShape(pptx.ShapeType.rect, {
          x: cx + 0.3, y: cy, w: 0.6, h: 0.04,
          fill: { color: theme.colors.brandAccent },
        });
        // Number badge
        s.addShape(pptx.ShapeType.ellipse, {
          x: cx + 0.2, y: cy + 0.25, w: 0.35, h: 0.35,
          fill: { color: theme.colors.brandAccent },
        });
        s.addText(`${i + 1}`, {
          x: cx + 0.2, y: cy + 0.25, w: 0.35, h: 0.35,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.white, bold: true, align: "center", valign: "middle",
        });
        // Feature text
        s.addText(f, {
          x: cx + 0.7, y: cy + 0.2, w: cardW - 0.9, h: 0.9,
          fontSize: theme.typography.bodySize, fontFace: theme.typography.family,
          color: theme.colors.text, valign: "top", lineSpacingMultiple: 1.3,
        });
      });
    }
  }

  /* ── Chart Slide — wide layout with insights ─────────────── */

  private chartSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme, charts: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });

    this.addWideTitle(s, pptx, slide.title, theme);

    const svg = charts.get(slide.id);
    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 0.5, y: 1.3, w: 8.5, h: 5 });
    } else {
      this.chartFallbackTable(s, slide, theme, 1.3);
    }

    // Insights sidebar
    if (slide.insights?.length) {
      const insightsX = 9.3;
      // Insight panel background
      s.addShape(pptx.ShapeType.roundRect, {
        x: insightsX, y: 1.3, w: 3.5, h: 5,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.border, width: 0.5 },
        rectRadius: 0.08,
      });
      s.addText("Insights", {
        x: insightsX + 0.2, y: 1.45, w: 3, h: 0.35,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      slide.insights.slice(0, 5).forEach((ins, i) => {
        s.addShape(pptx.ShapeType.ellipse, {
          x: insightsX + 0.2, y: 2.0 + i * 0.7, w: 0.1, h: 0.1,
          fill: { color: theme.colors.brandAccent },
        });
        s.addText(ins, {
          x: insightsX + 0.4, y: 1.85 + i * 0.7, w: 3, h: 0.6,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.text, valign: "top", lineSpacingMultiple: 1.3,
        });
      });
    }
  }

  /* ── Diagram Slide — wide layout ─────────────────────────── */

  private diagramSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme, diagrams: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });

    this.addWideTitle(s, pptx, slide.title, theme);

    const svg = diagrams.get(slide.id);
    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 0.5, y: 1.3, w: 12.33, h: 5.2 });
    } else {
      const diagramData = slide.diagramData as { code?: string } | undefined;
      if (diagramData?.code) {
        // Code block with dark background
        s.addShape(pptx.ShapeType.roundRect, {
          x: 0.5, y: 1.3, w: 12.33, h: 5.2,
          fill: { color: "#1E293B" },
          rectRadius: 0.1,
        });
        s.addText(diagramData.code, {
          x: 0.8, y: 1.5, w: 11.73, h: 4.8,
          fontSize: 10, fontFace: "Fira Code, Courier New",
          color: "#E2E8F0", valign: "top",
        });
      }
    }
  }

  /* ── Wireframe Slide ─────────────────────────────────────── */

  private wireframeSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme, wireframes: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });

    this.addWideTitle(s, pptx, slide.title, theme);

    const svg = wireframes.get(slide.id);
    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 1.5, y: 1.3, w: 10.33, h: 5.3 });
    }
  }

  /* ── Timeline Slide ──────────────────────────────────────── */

  private timelineSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });

    this.addWideTitle(s, pptx, slide.title, theme);

    const milestones = slide.milestones ?? [];
    if (!milestones.length) return;

    const lineY = 3.4;
    const startX = 1;
    const endX = 12.33;
    const step = (endX - startX) / Math.max(milestones.length - 1, 1);

    // Timeline line
    s.addShape(pptx.ShapeType.rect, {
      x: startX, y: lineY, w: endX - startX, h: 0.04,
      fill: { color: theme.colors.brandAccent },
    });

    milestones.forEach((m, i) => {
      const cx = startX + i * step;

      // Outer glow dot
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.18, y: lineY - 0.16, w: 0.36, h: 0.36,
        fill: { color: theme.colors.brandAccent, transparency: 70 },
      });
      // Inner dot
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.1, y: lineY - 0.08, w: 0.2, h: 0.2,
        fill: { color: theme.colors.brandAccent },
      });

      // Date above
      s.addText(m.date, {
        x: cx - 1, y: lineY - 1.1, w: 2, h: 0.35,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true, align: "center",
      });

      // Label + description below — alternating positions
      const isTop = i % 2 === 0;
      const textY = isTop ? lineY + 0.5 : lineY + 0.6;

      // Card background
      s.addShape(pptx.ShapeType.roundRect, {
        x: cx - 1, y: textY, w: 2, h: 1.6,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.border, width: 0.5 },
        rectRadius: 0.06,
      });

      s.addText(m.label, {
        x: cx - 0.85, y: textY + 0.1, w: 1.7, h: 0.4,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, align: "center",
      });

      s.addText(m.description, {
        x: cx - 0.85, y: textY + 0.5, w: 1.7, h: 0.9,
        fontSize: 9, fontFace: theme.typography.family,
        color: theme.colors.textLight, align: "center", valign: "top",
        lineSpacingMultiple: 1.3,
      });
    });
  }

  /* ── Team Slide ──────────────────────────────────────────── */

  private teamSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    const members = slide.members ?? [];
    const cols = Math.min(members.length, 4);
    const cardW = 2.7;
    const gap = 0.3;
    const totalW = cols * cardW + (cols - 1) * gap;
    const startX = 0.8 + (11.73 - totalW) / 2;

    members.slice(0, 4).forEach((m, i) => {
      const cx = startX + i * (cardW + gap);

      // Card
      s.addShape(pptx.ShapeType.roundRect, {
        x: cx, y: 1.8, w: cardW, h: 4.5,
        fill: { color: theme.colors.white },
        line: { color: theme.colors.border, width: 0.5 },
        rectRadius: 0.1,
        shadow: { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.08 },
      });

      // Colored header bar
      s.addShape(pptx.ShapeType.roundRect, {
        x: cx, y: 1.8, w: cardW, h: 1.2,
        fill: { color: theme.colors.brandPrimary },
        rectRadius: 0.1,
      });
      // Cover bottom corners of header
      s.addShape(pptx.ShapeType.rect, {
        x: cx, y: 2.5, w: cardW, h: 0.5,
        fill: { color: theme.colors.brandPrimary },
      });

      // Avatar circle on header
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx + cardW / 2 - 0.45, y: 2.1, w: 0.9, h: 0.9,
        fill: { color: theme.colors.brandAccent, transparency: 40 },
      });
      // Initials
      const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      s.addText(initials, {
        x: cx + cardW / 2 - 0.45, y: 2.1, w: 0.9, h: 0.9,
        fontSize: 14, fontFace: theme.typography.family,
        color: theme.colors.white, bold: true, align: "center", valign: "middle",
      });

      // Name
      s.addText(m.name, {
        x: cx + 0.15, y: 3.2, w: cardW - 0.3, h: 0.4,
        fontSize: 13, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, align: "center",
      });

      // Role
      s.addText(m.role, {
        x: cx + 0.15, y: 3.55, w: cardW - 0.3, h: 0.35,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, align: "center",
      });

      // Divider
      s.addShape(pptx.ShapeType.rect, {
        x: cx + 0.5, y: 4, w: cardW - 1, h: 0.01,
        fill: { color: theme.colors.border },
      });

      // Bio
      s.addText(m.bio, {
        x: cx + 0.2, y: 4.15, w: cardW - 0.4, h: 1.8,
        fontSize: 9, fontFace: theme.typography.family,
        color: theme.colors.textLight, align: "center", valign: "top",
        lineSpacingMultiple: 1.4,
      });
    });
  }

  /* ── CTA Slide ───────────────────────────────────────────── */

  private ctaSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "COVER_MASTER" });

    s.addText(slide.title ?? "Próximos Pasos", {
      x: 1, y: 2, w: 11.33, h: 1.5,
      fontSize: 38, fontFace: theme.typography.family,
      color: theme.colors.white, bold: true, align: "center",
    });

    // Accent line
    s.addShape(pptx.ShapeType.rect, {
      x: 5.5, y: 3.6, w: 2.33, h: 0.05,
      fill: { color: theme.colors.highlight },
    });

    if (slide.description) {
      s.addText(slide.description, {
        x: 2, y: 3.9, w: 9.33, h: 1,
        fontSize: 15, fontFace: theme.typography.family,
        color: lighten(theme.colors.white, 0.75), align: "center",
        lineSpacingMultiple: 1.4,
      });
    }

    if (slide.contactInfo) {
      s.addText(slide.contactInfo, {
        x: 3, y: 5.2, w: 7.33, h: 0.6,
        fontSize: 12, fontFace: theme.typography.family,
        color: lighten(theme.colors.white, 0.5), align: "center",
      });
    }
  }

  /* ── Default Slide ────────────────────────────────────────── */

  private defaultSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    if (slide.bullets?.length) {
      this.addBullets(slide.bullets, theme, 0.8, 1.6, 11.73, s);
    }
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  private addSectionTitle(s: ReturnType<PptxGenJS["addSlide"]>, pptx: PptxGenJS, title: string, theme: EvdDesignTheme): void {
    s.addText(title ?? "", {
      x: 0.8, y: 0.4, w: 11.73, h: 0.9,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });
    // Accent underline
    s.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 1.3, w: 1.5, h: 0.04,
      fill: { color: theme.colors.brandAccent },
    });
  }

  private addWideTitle(s: ReturnType<PptxGenJS["addSlide"]>, pptx: PptxGenJS, title: string, theme: EvdDesignTheme): void {
    s.addText(title ?? "", {
      x: 0.5, y: 0.25, w: 12.33, h: 0.85,
      fontSize: theme.typography.titleSize, fontFace: theme.typography.family,
      color: theme.colors.text, bold: true,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.1, w: 1.5, h: 0.04,
      fill: { color: theme.colors.brandAccent },
    });
  }

  private addBullets(
    bullets: string[],
    theme: EvdDesignTheme,
    x: number, y: number, w: number,
    s?: ReturnType<PptxGenJS["addSlide"]>,
  ): void {
    if (!s || !bullets.length) return;
    const bulletText = bullets.map((b) => ({
      text: b,
      options: { bullet: { code: "25CF", color: theme.colors.brandAccent }, breakType: "none" as const },
    }));
    s.addText(bulletText, {
      x, y, w, h: bullets.length * 0.4 + 0.3,
      fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
      color: theme.colors.text, lineSpacingMultiple: 1.5, valign: "top",
      paraSpaceAfter: 6,
    });
  }

  private chartFallbackTable(s: ReturnType<PptxGenJS["addSlide"]>, slide: EvdSlide, theme: EvdDesignTheme, startY: number): void {
    const chartData = slide.chartData as { labels?: string[]; datasets?: { label: string; values: number[] }[] } | undefined;
    if (!chartData?.labels?.length || !chartData.datasets?.length) return;

    const labels = chartData.labels;
    const headerRow = [{ text: "", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true } },
      ...labels.map((l) => ({ text: l, options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true } })),
    ] as PptxGenJS.TableRow[number][];

    const rows: PptxGenJS.TableRow[] = [
      headerRow,
      ...chartData.datasets.map((ds) => [
        { text: ds.label, options: { bold: true, color: theme.colors.text } },
        ...ds.values.map((v) => ({ text: String(v), options: {} })),
      ] as PptxGenJS.TableRow[number][]),
    ];

    s.addTable(rows, {
      x: 0.5, y: startY, w: 12.33,
      fontSize: 10, fontFace: theme.typography.family,
      color: theme.colors.text,
      border: { type: "solid", pt: 0.5, color: theme.colors.border },
      colW: [3, ...labels.map(() => (11.33 / labels.length))],
      autoPage: false,
    });
  }

  private svgToDataUri(svg: string): string {
    const encoded = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${encoded}`;
  }
}
