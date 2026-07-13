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
  description?: string;
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
      this.addSlide(pptx, slide, theme, renderedCharts, renderedDiagrams, logoBuffer);
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
    _logoBuffer?: Buffer | null,
  ): void {
    const type = slide.type?.toLowerCase() ?? "fallback";

    switch (type) {
      case "title":
        this.titleSlide(pptx, slide, theme);
        break;
      case "problem_statement":
        this.problemStatementSlide(pptx, slide, theme);
        break;
      case "solution_vision":
        this.solutionVisionSlide(pptx, slide, theme);
        break;
      case "current_vs_new":
        this.currentVsNewSlide(pptx, slide, theme);
        break;
      case "process_flow":
        this.processFlowSlide(pptx, slide, theme, diagrams);
        break;
      case "automations":
        this.automationsSlide(pptx, slide, theme, charts);
        break;
      case "key_features":
        this.keyFeaturesSlide(pptx, slide, theme);
        break;
      case "data_overview":
        this.dataOverviewSlide(pptx, slide, theme);
        break;
      case "integrations":
        this.integrationsSlide(pptx, slide, theme);
        break;
      case "security_access":
        this.securityAccessSlide(pptx, slide, theme);
        break;
      case "rollout_plan":
        this.rolloutPlanSlide(pptx, slide, theme);
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

    // Visual enhancements (background + illustration images)
    this.applyVisualEnhancements(pptx, slide);
  }

  /* ── Title Slide ────────────────────────────────────────────── */

  private titleSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
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

  /* ── Problem Statement — pain points + impact + urgency ─────── */

  private problemStatementSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;
    const painPoints = (slide.painPoints as string[]) ?? [];

    if (painPoints.length) {
      s.addText("Puntos de dolor", {
        x: 0.8, y: bodyY, w: 4, h: 0.35,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      bodyY += 0.4;
      this.addBullets(painPoints, theme, 0.8, bodyY, 11.73, s);
      bodyY += painPoints.length * 0.45 + 0.2;
    }

    if (slide.impact) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 5.5, h: 0.9,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.negative, width: 1 },
        rectRadius: 0.08,
      });
      s.addText([
        { text: "Impacto:  ", options: { bold: true, fontSize: 11, color: theme.colors.negative } },
        { text: String(slide.impact), options: { fontSize: 11, color: theme.colors.text } },
      ], {
        x: 1, y: bodyY + 0.1, w: 5.1, h: 0.7,
        fontFace: theme.typography.family, valign: "middle", lineSpacingMultiple: 1.3,
      });
      bodyY += 1.1;
    }

    if (slide.urgency) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 5.5, h: 0.9,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.highlight, width: 1 },
        rectRadius: 0.08,
      });
      s.addText([
        { text: "Urgencia:  ", options: { bold: true, fontSize: 11, color: theme.colors.highlight } },
        { text: String(slide.urgency), options: { fontSize: 11, color: theme.colors.text } },
      ], {
        x: 1, y: bodyY + 0.1, w: 5.1, h: 0.7,
        fontFace: theme.typography.family, valign: "middle", lineSpacingMultiple: 1.3,
      });
    }
  }

  /* ── Solution Vision — description + outcomes + target users ── */

  private solutionVisionSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;

    if (slide.description) {
      s.addText(String(slide.description), {
        x: 0.8, y: bodyY, w: 11.73, h: 1,
        fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
        color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.5,
      });
      bodyY += 1.2;
    }

    const outcomes = (slide.keyOutcomes as string[]) ?? [];
    if (outcomes.length) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.8, y: bodyY, w: 11.73, h: 0.9,
        fill: { color: theme.colors.brandAccent, transparency: 90 },
        line: { color: theme.colors.brandAccent, width: 1.5 },
        rectRadius: 0.12,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: bodyY + 0.15, w: 0.06, h: 0.6,
        fill: { color: theme.colors.brandAccent },
      });
      s.addText("Resultados esperados", {
        x: 1.1, y: bodyY + 0.1, w: 11.2, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      this.addBullets(outcomes, theme, 1.1, bodyY + 0.4, 11.2, s);
      bodyY += 1.2;
    }

    const users = (slide.targetUsers as string[]) ?? [];
    if (users.length) {
      s.addText("Usuarios objetivo", {
        x: 0.8, y: bodyY, w: 4, h: 0.35,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      this.addBullets(users, theme, 0.8, bodyY + 0.4, 11.73, s);
    }
  }

  /* ── Current vs New — side-by-side comparison ─────────────── */

  private currentVsNewSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });
    this.addWideTitle(s, pptx, slide.title, theme);

    const colW = 5.8;
    const leftX = 0.5;
    const rightX = 6.8;
    const topY = 1.3;

    // Current (left)
    s.addShape(pptx.ShapeType.roundRect, {
      x: leftX, y: topY, w: colW, h: 5.2,
      fill: { color: theme.colors.bgSubtle },
      line: { color: theme.colors.border, width: 0.5 },
      rectRadius: 0.1,
    });
    s.addText(String(slide.currentLabel ?? "Situación actual"), {
      x: leftX + 0.2, y: topY + 0.15, w: colW - 0.4, h: 0.4,
      fontSize: 14, fontFace: theme.typography.family,
      color: theme.colors.negative, bold: true,
    });
    const currentSteps = (slide.currentSteps as string[]) ?? [];
    if (currentSteps.length) {
      this.addNumberedList(currentSteps, theme, leftX + 0.3, topY + 0.7, colW - 0.6, s, theme.colors.negative, pptx);
    }

    // New (right)
    s.addShape(pptx.ShapeType.roundRect, {
      x: rightX, y: topY, w: colW, h: 5.2,
      fill: { color: theme.colors.bgSubtle },
      line: { color: theme.colors.brandAccent, width: 1 },
      rectRadius: 0.1,
    });
    s.addText(String(slide.newLabel ?? "Proceso nuevo"), {
      x: rightX + 0.2, y: topY + 0.15, w: colW - 0.4, h: 0.4,
      fontSize: 14, fontFace: theme.typography.family,
      color: theme.colors.brandAccent, bold: true,
    });
    const newSteps = (slide.newSteps as string[]) ?? [];
    if (newSteps.length) {
      this.addNumberedList(newSteps, theme, rightX + 0.3, topY + 0.7, colW - 0.6, s, theme.colors.brandAccent, pptx);
    }

    // Arrow between columns
    s.addText("→", {
      x: leftX + colW, y: topY + 2, w: rightX - leftX - colW, h: 1,
      fontSize: 28, fontFace: theme.typography.family,
      color: theme.colors.highlight, align: "center", valign: "middle",
    });

    // Improvement summary
    if (slide.improvementSummary) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.5, y: 6.0, w: 12.33, h: 0.7,
        fill: { color: theme.colors.positive, transparency: 90 },
        line: { color: theme.colors.positive, width: 1 },
        rectRadius: 0.06,
      });
      s.addText([
        { text: "Mejora:  ", options: { bold: true, fontSize: 12, color: theme.colors.positive } },
        { text: String(slide.improvementSummary), options: { fontSize: 12, color: theme.colors.text } },
      ], {
        x: 0.8, y: 6.05, w: 11.73, h: 0.6,
        fontFace: theme.typography.family, valign: "middle",
      });
    }
  }

  /* ── Process Flow — numbered steps with optional diagram ───── */

  private processFlowSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme, diagrams: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    const diagramData = slide.diagramData as { code?: string } | undefined;
    const svg = diagrams.get(slide.id);

    if (svg) {
      // Diagram takes center stage
      s.addImage({ data: this.svgToDataUri(svg), x: 0.5, y: 1.4, w: 12.33, h: 5 });
      return;
    }

    const steps = (slide.steps as { label: string; description?: string; automated?: boolean }[]) ?? [];
    if (!steps.length && diagramData?.code) {
      // Show mermaid code as fallback
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.5, y: 1.4, w: 12.33, h: 5,
        fill: { color: "#1E293B" },
        rectRadius: 0.1,
      });
      s.addText(diagramData.code, {
        x: 0.8, y: 1.6, w: 11.73, h: 4.6,
        fontSize: 10, fontFace: "Fira Code, Courier New",
        color: "#E2E8F0", valign: "top",
      });
      return;
    }

    // Render steps as horizontal cards
    const bodyY = 1.6;
    const cardW = 3.5;
    const cardGap = 0.3;
    steps.slice(0, 3).forEach((step, i) => {
      const cx = 0.8 + i * (cardW + cardGap);
      const cy = bodyY;

      s.addShape(pptx.ShapeType.roundRect, {
        x: cx, y: cy, w: cardW, h: 2.2,
        fill: { color: theme.colors.bgSubtle },
        line: { color: step.automated ? theme.colors.positive : theme.colors.border, width: step.automated ? 1.5 : 0.5 },
        rectRadius: 0.08,
      });

      // Step number badge
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx + 0.15, y: cy + 0.15, w: 0.4, h: 0.4,
        fill: { color: theme.colors.brandAccent },
      });
      s.addText(`${i + 1}`, {
        x: cx + 0.15, y: cy + 0.15, w: 0.4, h: 0.4,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.white, bold: true, align: "center", valign: "middle",
      });

      // Automated badge
      if (step.automated) {
        s.addShape(pptx.ShapeType.roundRect, {
          x: cx + cardW - 1.2, y: cy + 0.2, w: 1, h: 0.3,
          fill: { color: theme.colors.positive, transparency: 80 },
          rectRadius: 0.04,
        });
        s.addText("Automático", {
          x: cx + cardW - 1.2, y: cy + 0.2, w: 1, h: 0.3,
          fontSize: 7, fontFace: theme.typography.family,
          color: theme.colors.positive, align: "center", valign: "middle",
        });
      }

      s.addText(step.label, {
        x: cx + 0.15, y: cy + 0.7, w: cardW - 0.3, h: 0.5,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, valign: "top",
      });

      if (step.description) {
        s.addText(String(step.description), {
          x: cx + 0.15, y: cy + 1.2, w: cardW - 0.3, h: 0.8,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.3,
        });
      }

      // Arrow between steps
      if (i < steps.length - 1 && i < 2) {
        s.addText("→", {
          x: cx + cardW, y: cy + 0.8, w: cardGap, h: 0.6,
          fontSize: 18, fontFace: theme.typography.family,
          color: theme.colors.brandAccent, align: "center", valign: "middle",
        });
      }
    });
  }

  /* ── Automations — automation cards + time saved ──────────── */

  private automationsSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme, charts: Map<string, string>): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });
    this.addWideTitle(s, pptx, slide.title, theme);

    const automations = (slide.automations as { name: string; description?: string; timeSaved?: string }[]) ?? [];

    // Chart on left if present
    const svg = charts.get(slide.id);
    const contentX = svg ? 0.5 : 0.5;
    const contentW = svg ? 6 : 12.33;

    // Automation cards
    const cardH = 1.3;
    const cardGap = 0.2;
    automations.slice(0, 4).forEach((auto, i) => {
      const cy = 1.3 + i * (cardH + cardGap);

      s.addShape(pptx.ShapeType.roundRect, {
        x: contentX, y: cy, w: contentW, h: cardH,
        fill: { color: theme.colors.bgSubtle },
        line: { color: theme.colors.border, width: 0.5 },
        rectRadius: 0.08,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: contentX, y: cy, w: 0.06, h: cardH,
        fill: { color: theme.colors.positive },
      });

      s.addText(auto.name, {
        x: contentX + 0.2, y: cy + 0.1, w: contentW - 0.4, h: 0.4,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, valign: "middle",
      });

      if (auto.description) {
        s.addText(String(auto.description), {
          x: contentX + 0.2, y: cy + 0.5, w: contentW - 1.5, h: 0.4,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.textLight, valign: "top",
        });
      }

      if (auto.timeSaved) {
        s.addShape(pptx.ShapeType.roundRect, {
          x: contentX + contentW - 1.5, y: cy + 0.5, w: 1.3, h: 0.35,
          fill: { color: theme.colors.positive, transparency: 80 },
          rectRadius: 0.04,
        });
        s.addText(String(auto.timeSaved), {
          x: contentX + contentW - 1.5, y: cy + 0.5, w: 1.3, h: 0.35,
          fontSize: 9, fontFace: theme.typography.family,
          color: theme.colors.positive, bold: true, align: "center", valign: "middle",
        });
      }
    });

    // Chart on right
    if (svg) {
      s.addImage({ data: this.svgToDataUri(svg), x: 6.8, y: 1.3, w: 5.8, h: 5 });
    }
  }

  /* ── Key Features — feature cards with benefit ────────────── */

  private keyFeaturesSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    const features = (slide.features as { name: string; description?: string; benefit?: string }[]) ?? [];
    const bodyY = 1.6;
    const cardW = 3.6;
    const cardH = 2.2;
    const gap = 0.3;
    const cols = 3;

    features.slice(0, 6).forEach((feat, i) => {
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

      // Number badge
      s.addShape(pptx.ShapeType.ellipse, {
        x: cx + 0.15, y: cy + 0.15, w: 0.35, h: 0.35,
        fill: { color: theme.colors.brandAccent },
      });
      s.addText(`${i + 1}`, {
        x: cx + 0.15, y: cy + 0.15, w: 0.35, h: 0.35,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.white, bold: true, align: "center", valign: "middle",
      });

      s.addText(feat.name, {
        x: cx + 0.6, y: cy + 0.15, w: cardW - 0.8, h: 0.35,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, valign: "middle",
      });

      if (feat.description) {
        s.addText(String(feat.description), {
          x: cx + 0.15, y: cy + 0.6, w: cardW - 0.3, h: 0.7,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.3,
        });
      }

      if (feat.benefit) {
        s.addText([
          { text: "Beneficio:  ", options: { bold: true, fontSize: 9, color: theme.colors.positive } },
          { text: String(feat.benefit), options: { fontSize: 9, color: theme.colors.textLight } },
        ], {
          x: cx + 0.15, y: cy + 1.4, w: cardW - 0.3, h: 0.6,
          fontFace: theme.typography.family, valign: "top", lineSpacingMultiple: 1.3,
        });
      }
    });
  }

  /* ── Data Overview — data types table + optional flows ────── */

  private dataOverviewSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });
    this.addWideTitle(s, pptx, slide.title, theme);

    const dataTypes = (slide.dataTypes as { name: string; description?: string; sensitivity?: string }[]) ?? [];
    const flows = (slide.flows as { from: string; to: string; description?: string }[]) ?? [];

    // Data types table
    if (dataTypes.length) {
      const sensitivityColors: Record<string, string> = {
        high: theme.colors.negative,
        medium: theme.colors.highlight,
        low: theme.colors.positive,
      };

      const headerRow = [
        { text: "Tipo de dato", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true, fontSize: 10 } },
        { text: "Descripción", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true, fontSize: 10 } },
        { text: "Sensibilidad", options: { fill: { color: theme.colors.brandPrimary }, color: theme.colors.white, bold: true, fontSize: 10 } },
      ] as PptxGenJS.TableRow[number][];

      const rows: PptxGenJS.TableRow[] = [
        headerRow,
        ...dataTypes.map((dt) => [
          { text: dt.name, options: { bold: true, fontSize: 10, color: theme.colors.text } },
          { text: dt.description ?? "", options: { fontSize: 9, color: theme.colors.textLight } },
          { text: dt.sensitivity ?? "low", options: { fontSize: 9, color: sensitivityColors[dt.sensitivity ?? "low"] ?? theme.colors.text, bold: true } },
        ] as PptxGenJS.TableRow[number][]),
      ];

      s.addTable(rows, {
        x: 0.5, y: 1.3, w: flows.length ? 6 : 12.33,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.text,
        border: { type: "solid", pt: 0.5, color: theme.colors.border },
        colW: [2, 3, 1.5],
        autoPage: false,
      });
    }

    // Data flows
    if (flows.length) {
      const flowsX = dataTypes.length ? 6.8 : 0.5;
      const flowsW = dataTypes.length ? 5.5 : 12.33;

      s.addText("Flujos de datos", {
        x: flowsX, y: 1.3, w: flowsW, h: 0.35,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });

      flows.slice(0, 5).forEach((flow, i) => {
        const cy = 1.8 + i * 0.8;
        s.addText([
          { text: `${flow.from}`, options: { bold: true, fontSize: 10, color: theme.colors.brandAccent } },
          { text: "  →  ", options: { fontSize: 10, color: theme.colors.highlight } },
          { text: `${flow.to}`, options: { bold: true, fontSize: 10, color: theme.colors.brandAccent } },
        ], {
          x: flowsX, y: cy, w: flowsW, h: 0.3,
          fontFace: theme.typography.family,
        });
        if (flow.description) {
          s.addText(String(flow.description), {
            x: flowsX, y: cy + 0.3, w: flowsW, h: 0.3,
            fontSize: 9, fontFace: theme.typography.family,
            color: theme.colors.textLight,
          });
        }
      });
    }
  }

  /* ── Integrations — integration cards with direction ──────── */

  private integrationsSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    const integrations = (slide.integrations as { name: string; purpose?: string; direction?: string }[]) ?? [];
    const bodyY = 1.6;
    const cardW = 3.6;
    const cardH = 1.8;
    const gap = 0.3;
    const cols = 3;

    const directionIcons: Record<string, string> = {
      inbound: "←",
      outbound: "→",
      bidirectional: "↔",
    };
    const directionColors: Record<string, string> = {
      inbound: theme.colors.brandAccent,
      outbound: theme.colors.positive,
      bidirectional: theme.colors.highlight,
    };

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
        fill: { color: directionColors[intg.direction ?? "outbound"] ?? theme.colors.brandAccent },
      });

      s.addText(intg.name, {
        x: cx + 0.15, y: cy + 0.15, w: cardW - 0.3, h: 0.4,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.text, bold: true, valign: "middle",
      });

      // Direction badge
      const dir = intg.direction ?? "outbound";
      s.addShape(pptx.ShapeType.roundRect, {
        x: cx + 0.15, y: cy + 0.6, w: 1.4, h: 0.3,
        fill: { color: directionColors[dir] ?? theme.colors.brandAccent, transparency: 80 },
        rectRadius: 0.04,
      });
      s.addText(`${directionIcons[dir] ?? "→"} ${dir}`, {
        x: cx + 0.15, y: cy + 0.6, w: 1.4, h: 0.3,
        fontSize: 8, fontFace: theme.typography.family,
        color: directionColors[dir] ?? theme.colors.brandAccent, align: "center", valign: "middle",
      });

      if (intg.purpose) {
        s.addText(String(intg.purpose), {
          x: cx + 0.15, y: cy + 1.05, w: cardW - 0.3, h: 0.6,
          fontSize: 10, fontFace: theme.typography.family,
          color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.3,
        });
      }
    });
  }

  /* ── Security Access — roles + permissions + data protection ── */

  private securityAccessSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    let bodyY = 1.6;
    const roles = (slide.roles as { name: string; permissions?: string[] }[]) ?? [];

    if (roles.length) {
      s.addText("Roles y permisos", {
        x: 0.8, y: bodyY, w: 4, h: 0.35,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      bodyY += 0.4;

      roles.slice(0, 4).forEach((role, i) => {
        const cardW = 5.5;
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = 0.8 + col * (cardW + 0.3);
        const cy = bodyY + row * 1.2;

        s.addShape(pptx.ShapeType.roundRect, {
          x: cx, y: cy, w: cardW, h: 1,
          fill: { color: theme.colors.bgSubtle },
          line: { color: theme.colors.border, width: 0.5 },
          rectRadius: 0.06,
        });
        s.addShape(pptx.ShapeType.ellipse, {
          x: cx + 0.15, y: cy + 0.15, w: 0.35, h: 0.35,
          fill: { color: theme.colors.brandAccent },
        });
        s.addText(role.name, {
          x: cx + 0.6, y: cy + 0.1, w: cardW - 0.8, h: 0.4,
          fontSize: 11, fontFace: theme.typography.family,
          color: theme.colors.text, bold: true, valign: "middle",
        });

        if (role.permissions?.length) {
          s.addText(role.permissions.join(" · "), {
            x: cx + 0.15, y: cy + 0.55, w: cardW - 0.3, h: 0.4,
            fontSize: 9, fontFace: theme.typography.family,
            color: theme.colors.textLight, valign: "top",
          });
        }
      });
      bodyY += Math.ceil(roles.length / 2) * 1.2 + 0.2;
    }

    const dataProtection = (slide.dataProtection as string[]) ?? [];
    if (dataProtection.length) {
      s.addText("Protección de datos", {
        x: 0.8, y: bodyY, w: 4, h: 0.3,
        fontSize: 12, fontFace: theme.typography.family,
        color: theme.colors.brandAccent, bold: true,
      });
      this.addBullets(dataProtection, theme, 0.8, bodyY + 0.35, 11.73, s);
    }
  }

  /* ── Rollout Plan — phases + success criteria ─────────────── */

  private rolloutPlanSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });
    this.addWideTitle(s, pptx, slide.title, theme);

    const phases = (slide.phases as { label: string; description?: string; duration?: string }[]) ?? [];
    const bodyY = 1.3;

    if (phases.length) {
      const phaseW = Math.min(3.5, (12.33 - 0.3 * (phases.length - 1)) / phases.length);
      const totalW = phases.length * phaseW + (phases.length - 1) * 0.3;
      const startX = (13.33 - totalW) / 2;

      phases.slice(0, 5).forEach((phase, i) => {
        const px = startX + i * (phaseW + 0.3);

        s.addShape(pptx.ShapeType.roundRect, {
          x: px, y: bodyY, w: phaseW, h: 3.5,
          fill: { color: theme.colors.bgSubtle },
          line: { color: theme.colors.border, width: 0.5 },
          rectRadius: 0.08,
        });
        s.addShape(pptx.ShapeType.rect, {
          x: px, y: bodyY, w: phaseW, h: 0.04,
          fill: { color: theme.colors.brandAccent },
        });

        // Phase number
        s.addShape(pptx.ShapeType.ellipse, {
          x: px + 0.15, y: bodyY + 0.2, w: 0.4, h: 0.4,
          fill: { color: theme.colors.brandAccent },
        });
        s.addText(`${i + 1}`, {
          x: px + 0.15, y: bodyY + 0.2, w: 0.4, h: 0.4,
          fontSize: 12, fontFace: theme.typography.family,
          color: theme.colors.white, bold: true, align: "center", valign: "middle",
        });

        s.addText(phase.label, {
          x: px + 0.65, y: bodyY + 0.2, w: phaseW - 0.85, h: 0.4,
          fontSize: 12, fontFace: theme.typography.family,
          color: theme.colors.text, bold: true, valign: "middle",
        });

        if (phase.duration) {
          s.addShape(pptx.ShapeType.roundRect, {
            x: px + 0.15, y: bodyY + 0.75, w: 1.4, h: 0.25,
            fill: { color: theme.colors.highlight, transparency: 80 },
            rectRadius: 0.04,
          });
          s.addText(String(phase.duration), {
            x: px + 0.15, y: bodyY + 0.75, w: 1.4, h: 0.25,
            fontSize: 8, fontFace: theme.typography.family,
            color: theme.colors.highlight, align: "center", valign: "middle",
          });
        }

        if (phase.description) {
          s.addText(String(phase.description), {
            x: px + 0.15, y: bodyY + 1.15, w: phaseW - 0.3, h: 2,
            fontSize: 10, fontFace: theme.typography.family,
            color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.4,
          });
        }
      });
    }

    // Success criteria
    const criteria = (slide.successCriteria as string[]) ?? [];
    if (criteria.length) {
      const critY = bodyY + 3.8;
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.5, y: critY, w: 12.33, h: 0.4 + criteria.length * 0.35,
        fill: { color: theme.colors.positive, transparency: 92 },
        line: { color: theme.colors.positive, width: 0.5 },
        rectRadius: 0.06,
      });
      s.addText("Criterios de éxito", {
        x: 0.7, y: critY + 0.05, w: 4, h: 0.3,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.positive, bold: true,
      });
      this.addBullets(criteria, theme, 0.7, critY + 0.35, 11.93, s);
    }
  }

  /* ── Timeline — horizontal milestone line ────────────────── */

  private timelineSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "WIDE_MASTER" });
    this.addWideTitle(s, pptx, slide.title, theme);

    const milestones = (slide.milestones as { label: string; date?: string; description?: string }[]) ?? [];
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

      if (m.date) {
        s.addText(m.date, {
          x: cx - 1, y: lineY - 1.1, w: 2, h: 0.35,
          fontSize: 11, fontFace: theme.typography.family,
          color: theme.colors.brandAccent, bold: true, align: "center",
        });
      }

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

      if (m.description) {
        s.addText(String(m.description), {
          x: cx - 0.85, y: textY + 0.5, w: 1.7, h: 0.9,
          fontSize: 9, fontFace: theme.typography.family,
          color: theme.colors.textLight, align: "center", valign: "top",
          lineSpacingMultiple: 1.3,
        });
      }
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
      s.addText(String(slide.description), {
        x: 2, y: 3.9, w: 9.33, h: 1,
        fontSize: 15, fontFace: theme.typography.family,
        color: lighten(theme.colors.white, 0.75), align: "center",
        lineSpacingMultiple: 1.4,
      });
    }

    if (slide.contactInfo) {
      s.addText(String(slide.contactInfo), {
        x: 3, y: 5.2, w: 7.33, h: 0.6,
        fontSize: 12, fontFace: theme.typography.family,
        color: lighten(theme.colors.white, 0.5), align: "center",
      });
    }
  }

  /* ── Default / Fallback Slide ────────────────────────────── */

  private defaultSlide(pptx: PptxGenJS, slide: EvdSlide, theme: EvdDesignTheme): void {
    const s = pptx.addSlide({ masterName: "SIDEBAR_MASTER" });
    this.addSectionTitle(s, pptx, slide.title, theme);

    const bullets = (slide.bullets as string[]) ?? [];
    if (bullets.length) {
      this.addBullets(bullets, theme, 0.8, 1.6, 11.73, s);
    } else if (slide.description) {
      s.addText(String(slide.description), {
        x: 0.8, y: 1.6, w: 11.73, h: 4,
        fontSize: theme.typography.bodySize + 1, fontFace: theme.typography.family,
        color: theme.colors.textLight, valign: "top", lineSpacingMultiple: 1.5,
      });
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

  private addNumberedList(
    items: string[],
    theme: EvdDesignTheme,
    x: number, y: number, w: number,
    s: ReturnType<PptxGenJS["addSlide"]>,
    accentColor: string,
    pptx: PptxGenJS,
  ): void {
    items.slice(0, 6).forEach((item, i) => {
      const iy = y + i * 0.7;
      s.addShape(pptx.ShapeType.ellipse, {
        x, y: iy + 0.05, w: 0.3, h: 0.3,
        fill: { color: accentColor },
      });
      s.addText(`${i + 1}`, {
        x, y: iy + 0.05, w: 0.3, h: 0.3,
        fontSize: 10, fontFace: theme.typography.family,
        color: theme.colors.white, bold: true, align: "center", valign: "middle",
      });
      s.addText(item, {
        x: x + 0.4, y: iy, w: w - 0.4, h: 0.5,
        fontSize: 11, fontFace: theme.typography.family,
        color: theme.colors.text, valign: "middle", lineSpacingMultiple: 1.3,
      });
    });
  }

  private svgToDataUri(svg: string): string {
    const encoded = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${encoded}`;
  }

  /* ── Visual Enhancements (backgrounds + illustrations) ──────── */

  private applyVisualEnhancements(
    pptx: PptxGenJS,
    slide: EvdSlide,
  ): void {
    const slides = (pptx as unknown as { slides?: PptxGenJS.Slide[] }).slides;
    const lastSlide = slides?.[slides.length - 1];
    if (!lastSlide) return;

    // Background image (full-bleed, semi-transparent)
    if (slide.backgroundB64) {
      lastSlide.addImage({
        data: `image/png;base64,${slide.backgroundB64}`,
        x: 0, y: 0, w: "100%", h: "100%",
        sizing: { type: "cover", w: 13.33, h: 7.5 },
      });

      // Overlay layer matching web visualStyle
      const visualStyle = slide.visualStyle as string | undefined;
      const opacity =
        visualStyle === "data-driven" ? 0.45 :
        visualStyle === "minimal" ? 0.15 :
        visualStyle === "geometric" ? 0.30 :
        visualStyle === "organic" ? 0.25 :
        0.35;

      lastSlide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: "100%", h: "100%",
        fill: { color: "000000", transparency: Math.round((1 - opacity) * 100) },
        line: { color: "000000", transparency: Math.round((1 - opacity) * 100) },
      });
    }

    // Illustration (bottom-right corner)
    if (slide.illustrationB64) {
      lastSlide.addImage({
        data: `image/png;base64,${slide.illustrationB64}`,
        x: 9.5, y: 4.8, w: 3.5, h: 2.4,
        rounding: true,
      });
    }
  }
}
