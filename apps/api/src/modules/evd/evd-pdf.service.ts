import { Injectable, Logger } from "@nestjs/common";
import type { EvdDesignTheme } from "./evd-design-system.js";
import { buildTheme } from "./evd-design-system.js";
import type { EvdDeck } from "./evd-pptx.service.js";

@Injectable()
export class EvdPdfService {
  private readonly logger = new Logger(EvdPdfService.name);

  async generatePDF(
    deck: EvdDeck,
    renderedCharts: Map<string, string> = new Map(),
    renderedDiagrams: Map<string, string> = new Map(),
    renderedWireframes: Map<string, string> = new Map(),
  ): Promise<Buffer> {
    const theme = buildTheme(deck.branding as Record<string, unknown> | null);

    const html = this.buildHTML(deck, theme, renderedCharts, renderedDiagrams, renderedWireframes);

    try {
      const puppeteer = await import("puppeteer-core");
      const browser = await puppeteer.default.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium-browser",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: 30000 });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

      const buffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      await browser.close();
      return Buffer.from(buffer);
    } catch (err) {
      this.logger.error(`PDF generation failed: ${err}`);
      throw new Error(`PDF generation failed: ${err}`);
    }
  }

  private buildHTML(
    deck: EvdDeck,
    theme: EvdDesignTheme,
    charts: Map<string, string>,
    diagrams: Map<string, string>,
    wireframes: Map<string, string>,
  ): string {
    const slidesHTML = (deck.slides ?? [])
      .map((slide, i) => this.slideToHTML(slide, i, theme, charts, diagrams, wireframes))
      .join("\n    <div class=\"page-break\"></div>\n");

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1200"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page { size: A4 landscape; margin: 0; }

  body {
    font-family: 'Inter', ${theme.typography.family}, system-ui, sans-serif;
    color: ${theme.colors.text};
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 297mm;
    height: 210mm;
    padding: 15mm;
    position: relative;
    page-break-after: always;
    overflow: hidden;
    background: ${theme.colors.bg};
  }

  .page-cover {
    background: linear-gradient(135deg, ${theme.colors.brandPrimary}, ${theme.colors.brandSecondary});
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .page-cta {
    background: linear-gradient(135deg, ${theme.colors.brandPrimary}, ${theme.colors.brandSecondary});
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  .brand-line {
    width: 80px;
    height: 3px;
    background: ${theme.colors.brandPrimary};
    margin: 16px 0;
  }

  .page-break { page-break-after: always; }

  .slide-title {
    font-size: 22px;
    font-weight: 700;
    color: ${theme.colors.text};
    margin-bottom: 8px;
    line-height: 1.2;
  }

  .cover-title {
    font-size: 36px;
    font-weight: 900;
    color: #fff;
    text-align: center;
    line-height: 1.15;
  }

  .cover-subtitle {
    font-size: 16px;
    font-weight: 400;
    color: rgba(255,255,255,0.8);
    text-align: center;
    margin-top: 12px;
  }

  .bullets {
    list-style: none;
    padding: 0;
    margin: 12px 0;
  }

  .bullets li {
    padding: 6px 0 6px 20px;
    position: relative;
    font-size: 13px;
    line-height: 1.5;
    color: ${theme.colors.text};
  }

  .bullets li::before {
    content: "\\25CF";
    color: ${theme.colors.brandPrimary};
    position: absolute;
    left: 0;
    font-size: 8px;
    top: 10px;
  }

  .chart-svg {
    width: 100%;
    max-height: 400px;
    display: block;
    margin: 12px auto;
  }

  .diagram-svg, .wireframe-svg {
    width: 100%;
    max-height: 420px;
    display: block;
    margin: 12px auto;
  }

  .problem-text, .description-text {
    font-size: 14px;
    line-height: 1.6;
    color: ${theme.colors.text};
    margin-bottom: 12px;
  }

  .impact-box {
    background: ${theme.colors.highlight}10;
    border-left: 3px solid ${theme.colors.highlight};
    padding: 12px 16px;
    font-size: 13px;
    color: ${theme.colors.highlight};
    font-weight: 600;
    border-radius: 0 6px 6px 0;
    margin-top: 12px;
  }

  .timeline-container {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin: 24px 0 12px;
    position: relative;
  }

  .timeline-line {
    position: absolute;
    top: 12px;
    left: 0;
    right: 0;
    height: 3px;
    background: ${theme.colors.brandPrimary};
    z-index: 0;
  }

  .timeline-item {
    flex: 1;
    text-align: center;
    position: relative;
    z-index: 1;
    padding: 0 8px;
  }

  .timeline-dot {
    width: 14px;
    height: 14px;
    background: ${theme.colors.brandPrimary};
    border-radius: 50%;
    margin: 5px auto 12px;
  }

  .timeline-date {
    font-size: 11px;
    font-weight: 700;
    color: ${theme.colors.brandPrimary};
  }

  .timeline-label {
    font-size: 12px;
    font-weight: 600;
    color: ${theme.colors.text};
    margin-top: 4px;
  }

  .timeline-desc {
    font-size: 10px;
    color: ${theme.colors.textLight};
    margin-top: 2px;
  }

  .team-grid {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin: 20px 0;
  }

  .team-card {
    flex: 0 0 22%;
    background: ${theme.colors.bgSubtle};
    border: 1px solid ${theme.colors.border};
    border-radius: 10px;
    padding: 20px;
    text-align: center;
  }

  .team-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: ${theme.colors.brandPrimary}20;
    margin: 0 auto 10px;
  }

  .team-name { font-size: 14px; font-weight: 700; color: ${theme.colors.text}; }
  .team-role { font-size: 11px; color: ${theme.colors.brandPrimary}; margin: 4px 0; }
  .team-bio { font-size: 10px; color: ${theme.colors.textLight}; line-height: 1.4; }

  .cta-title {
    font-size: 32px;
    font-weight: 900;
    color: #fff;
    text-align: center;
  }

  .cta-desc {
    font-size: 15px;
    color: rgba(255,255,255,0.8);
    text-align: center;
    margin-top: 16px;
    max-width: 600px;
  }

  .cta-contact {
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    text-align: center;
    margin-top: 32px;
  }

  .footer {
    position: absolute;
    bottom: 12mm;
    left: 15mm;
    right: 15mm;
    font-size: 8px;
    color: ${theme.colors.textLight};
    display: flex;
    justify-content: space-between;
  }

  .insight-box {
    background: ${theme.colors.bgSubtle};
    border-radius: 8px;
    padding: 10px 14px;
    margin: 8px 0;
    font-size: 12px;
    color: ${theme.colors.text};
    border-left: 3px solid ${theme.colors.brandAccent};
  }
</style>
</head>
<body>
    ${slidesHTML}
</body>
</html>`;
  }

  private slideToHTML(
    slide: Record<string, unknown>,
    index: number,
    theme: EvdDesignTheme,
    charts: Map<string, string>,
    diagrams: Map<string, string>,
    wireframes: Map<string, string>,
  ): string {
    const type = (slide.type as string)?.toLowerCase() ?? "narrative";
    const title = (slide.title as string) ?? "";
    const slideId = (slide.id as string) ?? `slide-${index}`;

    let pageClass = "page";
    let content = "";

    switch (type) {
      case "title":
        pageClass += " page-cover";
        content = `
      <div class="cover-title">${this.esc(title)}</div>
      ${slide.subtitle ? `<div class="cover-subtitle">${this.esc(slide.subtitle as string)}</div>` : ""}`;
        break;

      case "executive_summary":
      case "solution_overview":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      ${slide.description ? `<div class="description-text">${this.esc(slide.description as string)}</div>` : ""}
      <ul class="bullets">
        ${(slide.bullets as string[] ?? []).map((b) => `<li>${this.esc(b)}</li>`).join("\n        ")}
      </ul>
      ${(slide.keyFeatures as string[] ?? []).length ? `
      <div style="margin-top:12px"><strong style="font-size:12px;color:${theme.colors.brandPrimary}">Características clave:</strong></div>
      <ul class="bullets">
        ${(slide.keyFeatures as string[]).map((f) => `<li>${this.esc(f)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;

      case "problem_statement":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      ${slide.problem ? `<div class="problem-text">${this.esc(slide.problem as string)}</div>` : ""}
      ${slide.impact ? `<div class="impact-box">Impacto: ${this.esc(slide.impact as string)}</div>` : ""}`;
        break;

      case "market_analysis":
      case "data_chart":
      case "financials":
        const chartSvg = charts.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      ${chartSvg ? `<div class="chart-svg">${chartSvg}</div>` : ""}
      ${(slide.insights as string[] ?? []).map((ins) => `<div class="insight-box">${this.esc(ins)}</div>`).join("\n")}`;
        break;

      case "architecture_diagram":
        const diagSvg = diagrams.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      ${diagSvg ? `<div class="diagram-svg">${diagSvg}</div>` : ""}`;
        break;

      case "wireframe":
        const wfSvg = wireframes.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      ${wfSvg ? `<div class="wireframe-svg">${wfSvg}</div>` : ""}`;
        break;

      case "timeline":
        const milestones = (slide.milestones as { label: string; date: string; description: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      <div class="timeline-container">
        <div class="timeline-line"></div>
        ${milestones.map((m) => `
        <div class="timeline-item">
          <div class="timeline-date">${this.esc(m.date)}</div>
          <div class="timeline-dot"></div>
          <div class="timeline-label">${this.esc(m.label)}</div>
          <div class="timeline-desc">${this.esc(m.description)}</div>
        </div>`).join("\n")}
      </div>`;
        break;

      case "team":
        const members = (slide.members as { name: string; role: string; bio: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      <div class="team-grid">
        ${members.map((m) => `
        <div class="team-card">
          <div class="team-avatar"></div>
          <div class="team-name">${this.esc(m.name)}</div>
          <div class="team-role">${this.esc(m.role)}</div>
          <div class="team-bio">${this.esc(m.bio)}</div>
        </div>`).join("\n")}
      </div>`;
        break;

      case "cta":
        pageClass += " page-cta";
        content = `
      <div class="cta-title">${this.esc(title)}</div>
      ${slide.description ? `<div class="cta-desc">${this.esc(slide.description as string)}</div>` : ""}
      ${slide.contactInfo ? `<div class="cta-contact">${this.esc(slide.contactInfo as string)}</div>` : ""}`;
        break;

      default:
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="brand-line"></div>
      ${(slide.bullets as string[] ?? []).map((b) => `<div style="font-size:13px;padding:4px 0;">${this.esc(b)}</div>`).join("\n")}`;
        break;
    }

    return `    <div class="${pageClass}">
      ${content}
      <div class="footer">
        <span>Confidential</span>
        <span>${index + 1} / ${this.slideCount ?? "?"}</span>
      </div>
    </div>`;
  }

  private slideCount: number | undefined;

  private esc(str: string): string {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
