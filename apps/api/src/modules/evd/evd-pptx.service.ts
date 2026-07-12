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
  description?: string;
  valueProposition?: string;
  targetUsers?: string[];
  flows?: { name: string; steps: string[]; description?: string }[];
  featureName?: string;
  benefits?: string[];
  howItWorks?: string;
  chartData?: Record<string, unknown>;
  diagramData?: { diagramType: string; code: string } | Record<string, unknown>;
  wireframeData?: Record<string, unknown>;
  entities?: { name: string; fields: string[]; description?: string }[];
  integrations?: { name: string; type?: string; purpose?: string; provider?: string }[];
  authMethod?: string;
  roles?: string[];
  dataProtection?: string[];
  environment?: string;
  phases?: { label: string; description?: string }[];
  ciCd?: string;
  milestones?: { label: string; date: string; description: string }[];
  contactInfo?: string;
  columns?: { header: string; align?: string }[];
  rows?: string[][];
  insights?: string[];
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
    pptx.defineSlideMaster({
      title: "COVER_MASTER",
      background: { color: theme.colors.brandPrimary },
      objects: [
        { rect: { x: 8, y: -1, w: 7, h: 3.5, rotate: -15, fill: { color: theme.colors.brandAccent, transparency: 85 } } },
        { rect: { x: 0, y: 6.85, w: "100%", h: 0.15, fill: { color: theme.colors.highlight } } },
        { rect: { x: 0.6, y: 6.9, w: 0.8, h: 0.03, fill: { color: theme.colors.white, transparency: 60 } } },
      ],
    });

    pptx.defineSlideMaster({
      title: "SIDEBAR_MASTER",
      background: { color: theme.colors.white },
      objects: [
        { rect: { x: 0, y: 0, w: 0.35, h: "100%", fill: { color: theme.colors.brandPrimary } } },
        { rect: { x: 0.35, y: 0, w: 0.04, h: "100%", fill: { color: theme.colors.brandAccent } } },
        { rect: { x: 0.39, y: 0, w: "100%", h: 0.02, fill: { color: theme.colors.border } } },
        {
          text: {
            text: "Confidential",
            options: { x: 0.7, y: 6.95, w: 3, h: 0.3, fontSize: 8, color: theme.colors.textMuted, fontFace: theme.typography.family },
          },
        },
      ],
    });

    pptx.defineSlideMaster({
      title: "WIDE_MASTER",
      background: { color: theme.colors.white },
      objects: [
        { rect: { x: 0, y: 0, w: "100%", h: 0.06, fill: { color: theme.colors.brandPrimary } } },
        { rect: { x: 0.5, y: 6.9, w: 12.33, h: 0.01, fill: { color: theme.colors.border } } },
        {
          text: {
            text: "Confidential",
            options: { x: 0.5, y: 6.95, w: 3, h: 0.3, fontSize: 8, color: theme.colors.textMuted, fontFace: theme.typography.family },
          },
        },
      ],
    });

    pptx.defineSlideMaster({
      title: "SECTION_MASTER",
      background: { color: theme.colors.brandSecondary },
      objects: [
        { rect: { x: 10, y: -0.5, w: 4, h: 4, fill: { color: theme.colors.brandAccent, transparency: 80 } } },
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
      case "product_overview":
        this.productOverviewSlide(pptx, slide, theme);
        break;
      case "user_flows":
        this.userFlowsSlide(pptx, slide, theme);
        break;
      case "feature_deep_dive":
        this.featureDeepDiveSlide(pptx, slide, theme);
        break;
      case "data_chart":
        this.chartSlide(pptx, slide, theme, charts);
        break;
      case "architecture_diagram":
        this.diagramSlide(pptx, slide, theme, diagrams);
        break;
      case "data_model":
        this.dataModelSlide(pptx, slide, theme, diagrams);
        break;
      case "wireframe":
        this.wireframeSlide(pptx, slide, theme, wireframes);
        break;
      case "integration_points":
        this.integrationPointsSlide(pptx, slide, theme);
        break;
      case "security_model":
        this.securityModelSlide(pptx, slide, theme);
        break;
      case "deployment_plan":
        this.deploymentPlanSlide(pptx, slide, theme);
        break;
      case "timeline":
        this.timelineSlide(pptx, slide, theme);
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

    s.addText(slide.title ?? "", {
      x: 1.2, y: 1.8, w: 10.93, h: 2,
      fontSize: 44, fontFace: theme.typography.family,
      color: theme.colors.white, bold: true, align: "left",
      lineSpacingMultiple: 1.1,
    });

    s.addShape(pptx.ShapeType.rect, {
      x: 1.2, y: 3.85, w: 2.5, h: 0.06,
      fill: { color: theme.colors.highlight },
    });

    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 1.2, y: 4.15, w: 10.93, h: 0.8,
        fontSize: 18, fontFace: theme.typography.family,
        color: lighten(theme.colors.white, 0.7), align: "left",
        lineSpacingMultiple: 1.3,
      });
    }

    s.addText("Executive Vision Deck", {
      x: 1.2, y: 6.2, w: 4, h: 0.4,
      fontSize: 10, fontFace: theme.typography.family,
      color: lighten(theme.colors.white, 0.5), align: "left",
    });
  }

  /* ── Product Overview — description + value proposition + target users ── */

  private productOverviewSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
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

    if (slide.valueProposition) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 11.73, h: 1,
        fill: { color: theme.colors.brandAccent, transparency: 90 },
        line: { color: theme.colors.brandAccent, width: 1.5 },
        rectRadius: 0.12,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: bodyY + 0.15, w: 0.06, h: 0.7,
        fill: { color: theme.colors.brandAccent },
      });
      s.addText([
        { text: "Propuesta de valor:  ", options: { bold: true, fontSize: 12, color: theme.colors.brandAccent } },
        { text: slide.valueProposition, options: { fontSize: 12, color: theme.colors.text } },
      ], {
        x: 1.1, y: bodyY + 0.15, w: 11.2, h: 0.7,
        fontFace: theme.typography.family, valign: "middle", lineSpacingMultiple: 1.4,
      });
      bodyY += 1.3;
    }

    if (slide.targetUsers?.length) {
      s.addText("Usuarios objetivo", {
        x: 0.8, y: bodyY, w: 4, h: 0.35,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      this.addBullets(slide.targetUsers, theme, 0.8, bodyY + 0.4, 11.73, s);
    }
  }

  /* ── User Flows — flow steps with numbered cards ─────────── */

  private userFlowsSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    const flows = slide.flows ?? [];
    const bodyY = 1.6;

    flows.slice(0, 3).forEach((flow, fi) => {
      const fy = bodyY + fi * 1.8;

      s.addText(flow.name, {
        x: 0.8, y: fy, w: 4, h: 0.35,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });

      if (flow.description) {
        s.addText(flow.description, {
          x: 0.8, y: fy + 0.3, w: 11.73, h: 0.3,
          fontSize: 9, fontFace: theme.typography.family,
          color: theme.colors.textLight, italic: true,
        });
      }

      const steps = flow.steps ?? [];
      const stepW = 3.5;
      const stepGap = 0.3;
      steps.slice(0, 3).forEach((step, si) => {
        const sx = 0.8 + si * (stepW + stepGap);
        const sy = fy + 0.7;

        s.addShape(pptx.ShapeType.roundRect, {
          x: sx, y: sy, w: stepW, h: 0.8,
          fill: { color: theme.colors.bgSubtle },
          line: { color: theme.colors.border, width: 0.5 },
          rectRadius: 0.06,
        });
        s.addShape(pptx.ShapeType.ellipse, {
          x: sx + 0.1, y: sy + 0.2, w: 0.35, h: 0.35,
          fill: { color: theme.colors.brandAccent },
        });
        s.addText(`${si + 1}`, {
          x: sx + 0.1, y: sy + 0.2, w: 0.35, h: 0.35,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.white, bold: true, align: "center", valign: "middle",
        });
        s.addText(step, {
          x: sx + 0.55, y: sy + 0.1, w: stepW - 0.7, h: 0.6,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.text, valign: "middle", lineSpacingMultiple: 1.2,
        });

        // Arrow between steps
        if (si < steps.length - 1 && si < 2) {
          s.addText("→", {
            x: sx + stepW, y: sy + 0.15, w: stepGap, h: 0.5,
            fontSize: 16, fontFace: theme.typography.family,
            color: theme.colors.brandAccent, align: "center", valign: "middle",
          });
        }
      });
    });
  }

  /* ── Feature Deep Dive — feature name + benefits + how it works ── */

  private featureDeepDiveSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;

    if (slide.featureName) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 4, h: 0.5,
        fill: { color: theme.colors.brandAccent },
        rectRadius: 0.06,
      });
      s.addText(slide.featureName, {
        x: 0.95, y: bodyY + 0.05, w: 3.7, h: 0.4,
        fontSize: 13, fontFace: theme.typography.family,
        color: theme.colors.white, bold: true, valign: "middle",
      });
      bodyY += 0.7;
    }

    if (slide.description) {
      s.addText(slide.description, {
        x: 0.8, y: bodyY, w: 11.73, h: 0.8,
        fontSize: theme.typography.bodySize, fontFace: theme.typography.family,
        color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.5,
      });
      bodyY += 1.0;
    }

    if (slide.benefits?.length) {
      s.addText("Beneficios", {
        x: 0.8, y: bodyY, w: 4, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      bodyY += 0.35;
      const col1 = slide.benefits.slice(0, Math.ceil(slide.benefits.length / 2));
      const col2 = slide.benefits.slice(Math.ceil(slide.benefits.length / 2));

      const renderCol = (items: string[], startX: number, colW: number) => {
        items.forEach((b, i) => {
          s.addShape(pptx.ShapeType.ellipse, {
            x: startX, y: bodyY + i * 0.45, w: 0.1, h: 0.1,
            fill: { color: theme.colors.brandAccent },
          });
          s.addText(b, {
            x: startX + 0.2, y: bodyY - 0.05 + i * 0.45, w: colW - 0.3, h: 0.35,
            fontSize: 10, fontFace: theme.typography.family,
            color: theme.colors.text, valign: "middle",
          });
        });
      };

      renderCol(col1, 0.8, 5.5);
      if (col2.length) renderCol(col2, 6.8, 5.5);
      bodyY += Math.max(col1.length, col2.length) * 0.45 + 0.2;
    }

    if (slide.howItWorks) {
      s.addText("Cómo funciona", {
        x: 0.8, y: bodyY, w: 4, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      s.addText(slide.howItWorks, {
        x: 0.8, y: bodyY + 0.35, w: 11.73, h: 1.5,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.text, valign: "top", lineSpacingMultiple: 1.5,
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

    if (slide.insights?.length) {
      const insightsX = 9.3;
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

  /* ── Data Model — entities table + optional ER diagram ───── */

  private dataModelSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme, diagrams: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });

    this.addWideTitle(s, pptx, slide.title, theme);

    const entities = slide.entities ?? [];
    const svg = diagrams.get(slide.id);

    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 0.5, y: 1.3, w: 6, h: 5 });
    }

    if (entities.length) {
      const tableX = svg ? 6.8 : 0.5;
      const tableW = svg ? 5.5 : 12.33;

      const headerRow = [
        { text: "Entidad", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true, fontSize: 10 } },
        { text: "Campos", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true, fontSize: 10 } },
        { text: "Descripción", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true, fontSize: 10 } },
      ] as PptxGenJS.TableRow[number][];

      const rows: PptxGenJS.TableRow[] = [
        headerRow,
        ...entities.map((e) => [
          { text: e.name, options: { bold: true, fontSize: 9, color: theme.colors.text } },
          { text: e.fields.join(", "), options: { fontSize: 8, color: theme.colors.textLight } },
          { text: e.description ?? "", options: { fontSize: 8, color: theme.colors.textLight } },
        ] as PptxGenJS.TableRow[number][]),
      ];

      s.addTable(rows, {
        x: tableX, y: 1.3, w: tableW,
        fontSize: 9, fontFace: theme.typography.family,
        color: theme.colors.text,
        border: { type: "solid", pt: 0.5, color: theme.colors.border },
        colW: [tableW * 0.2, tableW * 0.45, tableW * 0.35],
        autoPage: false,
      });
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

  /* ── Integration Points — integration cards ──────────────── */

  private integrationPointsSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    const integrations = slide.integrations ?? [];
    const bodyY = 1.6;
    const cardW = 3.6;
    const cardH = 2.2;
    const gap = 0.3;
    const cols = Math.min(integrations.length, 3);

    integrations.slice(0, 6).forEach((intg, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = 0.8 + col * (cardW + gap);
      const cy = bodyY + row * (cardH + gap);

      s.addShape(pptx.ShapeType.roundRect, {
        x: cx, y: cy, w: cardW, h: cardH,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.border, width: 0.5 },
        rectRadius: 0.08,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: cx, y: cy, w: cardW, h: 0.04,
        fill: { color: theme.colors.brandAccent },
      });
      s.addText(intg.name, {
        x: cx + 0.15, y: cy + 0.15, w: cardW - 0.3, h: 0.4,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, valign: "middle",
      });
      if (intg.type) {
        s.addShape(pptx.ShapeType.roundRect, {
          x: cx + 0.15, y: cy + 0.6, w: 1.2, h: 0.3,
          fill: { color: theme.colors.brandAccent, transparency: 80 },
          rectRadius: 0.04,
        });
        s.addText(intg.type, {
          x: cx + 0.15, y: cy + 0.6, w: 1.2, h: 0.3,
          fontSize: 8, fontFace: theme.typography.family,
          color: theme.colors.brandAccent, align: "center", valign: "middle",
        });
      }
      if (intg.purpose) {
        s.addText(intg.purpose, {
          x: cx + 0.15, y: cy + 1.05, w: cardW - 0.3, h: 0.4,
          fontSize: 9, fontFace: theme.typography.family,
          color: theme.colors.textLight, valign: "top",
        });
      }
      if (intg.provider) {
        s.addText(`Provider: ${intg.provider}`, {
          x: cx + 0.15, y: cy + 1.5, w: cardW - 0.3, h: 0.3,
          fontSize: 8, fontFace: theme.typography.family,
          color: theme.colors.textMuted, italic: true,
        });
      }
    });
  }

  /* ── Security Model — auth method + roles + data protection ── */

  private securityModelSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;

    if (slide.authMethod) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 5, h: 0.6,
        fill: { color: theme.colors.brandAccent, transparency: 85 },
        line: { color: theme.colors.brandAccent, width: 1 },
        rectRadius: 0.08,
      });
      s.addText([
        { text: "Autenticación:  ", options: { bold: true, fontSize: 11, color: theme.colors.brandAccent } },
        { text: slide.authMethod, options: { fontSize: 11, color: theme.colors.text } },
      ], {
        x: 1, y: bodyY + 0.05, w: 4.6, h: 0.5,
        fontFace: theme.typography.family, valign: "middle",
      });
      bodyY += 0.9;
    }

    if (slide.roles?.length) {
      s.addText("Roles del sistema", {
        x: 0.8, y: bodyY, w: 4, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      bodyY += 0.35;
      slide.roles.forEach((role, i) => {
        s.addShape(pptx.ShapeType.roundRect, {
          x: 0.8 + i * 2.2, y: bodyY, w: 2, h: 0.4,
          fill: { color: theme.colors.bgSubtle },
          line: { color: theme.colors.border, width: 0.5 },
          rectRadius: 0.06,
        });
        s.addText(role, {
          x: 0.8 + i * 2.2, y: bodyY, w: 2, h: 0.4,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.text, align: "center", valign: "middle",
        });
      });
      bodyY += 0.7;
    }

    if (slide.dataProtection?.length) {
      s.addText("Protección de datos", {
        x: 0.8, y: bodyY, w: 4, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      this.addBullets(slide.dataProtection, theme, 0.8, bodyY + 0.35, 11.73, s);
    }
  }

  /* ── Deployment Plan — environment + phases + CI/CD ──────── */

  private deploymentPlanSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });

    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;

    if (slide.environment) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 5, h: 0.6,
        fill: { color: theme.colors.brandAccent, transparency: 85 },
        line: { color: theme.colors.brandAccent, width: 1 },
        rectRadius: 0.08,
      });
      s.addText([
        { text: "Entorno:  ", options: { bold: true, fontSize: 11, color: theme.colors.brandAccent } },
        { text: slide.environment, options: { fontSize: 11, color: theme.colors.text } },
      ], {
        x: 1, y: bodyY + 0.05, w: 4.6, h: 0.5,
        fontFace: theme.typography.family, valign: "middle",
      });
      bodyY += 0.9;
    }

    const phases = slide.phases ?? [];
    if (phases.length) {
      const phaseW = 3.5;
      const phaseGap = 0.3;
      phases.slice(0, 4).forEach((phase, i) => {
        const px = 0.8 + i * (phaseW + phaseGap);
        s.addShape(pptx.ShapeType.roundRect, {
          x: px, y: bodyY, w: phaseW, h: 1.4,
          fill: { color: theme.colors.bgSubtle },
          line: { color: theme.colors.border, width: 0.5 },
          rectRadius: 0.08,
        });
        s.addShape(pptx.ShapeType.ellipse, {
          x: px + 0.15, y: bodyY + 0.15, w: 0.35, h: 0.35,
          fill: { color: theme.colors.brandAccent },
        });
        s.addText(`${i + 1}`, {
          x: px + 0.15, y: bodyY + 0.15, w: 0.35, h: 0.35,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.white, bold: true, align: "center", valign: "middle",
        });
        s.addText(phase.label, {
          x: px + 0.6, y: bodyY + 0.15, w: phaseW - 0.8, h: 0.35,
          fontSize: 11, fontFace: theme.typography.family,
          color: theme.colors.text, bold: true, valign: "middle",
        });
        if (phase.description) {
          s.addText(phase.description, {
            x: px + 0.15, y: bodyY + 0.6, w: phaseW - 0.3, h: 0.6,
            fontSize: 9, fontFace: theme.typography.family,
            color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.3,
          });
        }
      });
      bodyY += 1.7;
    }

    if (slide.ciCd) {
      s.addText("CI/CD", {
        x: 0.8, y: bodyY, w: 4, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      s.addText(slide.ciCd, {
        x: 0.8, y: bodyY + 0.35, w: 11.73, h: 0.5,
        fontSize: 10, fontFace: "Fira Code, Courier New",
        color: theme.colors.text, valign: "top",
      });
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

    s.addShape(pptx.ShapeType.rect, {
      x: startX, y: lineY, w: endX - startX, h: 0.04,
      fill: { color: theme.colors.brandAccent },
    });

    milestones.forEach((m, i) => {
      const cx = startX + i * step;

      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.18, y: lineY - 0.16, w: 0.36, h: 0.36,
        fill: { color: theme.colors.brandAccent, transparency: 70 },
      });
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx - 0.1, y: lineY - 0.08, w: 0.2, h: 0.2,
        fill: { color: theme.colors.brandAccent },
      });

      s.addText(m.date, {
        x: cx - 1, y: lineY - 1.1, w: 2, h: 0.35,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true, align: "center",
      });

      const textY = lineY + 0.5;

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

  /* ── CTA Slide ───────────────────────────────────────────── */

  private ctaSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "COVER_MASTER" });

    s.addText(slide.title ?? "¿Aprobamos?", {
      x: 1, y: 2, w: 11.33, h: 1.5,
      fontSize: 38, fontFace: theme.typography.family,
      color: theme.colors.white, bold: true, align: "center",
    });

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
