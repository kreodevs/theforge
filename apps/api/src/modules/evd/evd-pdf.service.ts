import { Injectable, Logger } from "@nestjs/common";
import type { EvdDesignTheme } from "./evd-design-system.js";
import { buildTheme, lighten } from "./evd-design-system.js";
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
    const total = deck.slides?.length ?? 0;
    const slidesHTML = (deck.slides ?? [])
      .map((slide, i) => this.slideToHTML(slide, i, total, theme, charts, diagrams, wireframes))
      .join('\n    <div class="page-break"></div>\n');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1200"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  :root {
    --brand-primary: ${theme.colors.brandPrimary};
    --brand-secondary: ${theme.colors.brandSecondary};
    --brand-accent: ${theme.colors.brandAccent};
    --highlight: ${theme.colors.highlight};
    --text: ${theme.colors.text};
    --text-light: ${theme.colors.textLight};
    --text-muted: ${theme.colors.textMuted};
    --bg: ${theme.colors.bg};
    --bg-subtle: ${theme.colors.bgSubtle};
    --border: ${theme.colors.border};
    --white: ${theme.colors.white};
    --positive: ${theme.colors.positive};
    --negative: ${theme.colors.negative};
    --sidebar-w: 24px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 landscape; margin: 0; }

  body {
    font-family: 'Inter', ${theme.typography.family}, system-ui, sans-serif;
    color: var(--text);
    background: var(--white);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page Base ────────────────────────────────────────── */
  .page {
    width: 297mm;
    height: 210mm;
    padding: 14mm 16mm 14mm 28mm;
    position: relative;
    page-break-after: always;
    overflow: hidden;
    background: var(--white);
  }
  .page::before {
    content: '';
    position: absolute;
    left: 0; top: 0;
    width: var(--sidebar-w);
    height: 100%;
    background: var(--brand-primary);
  }
  .page::after {
    content: '';
    position: absolute;
    left: var(--sidebar-w); top: 0;
    width: 3px;
    height: 100%;
    background: var(--brand-accent);
  }

  .page-break { page-break-after: always; }

  /* ── Cover Page ───────────────────────────────────────── */
  .page-cover {
    padding: 0;
    background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 60%, color-mix(in srgb, var(--brand-accent) 30%, var(--brand-secondary)) 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    color: var(--white);
  }
  .page-cover::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: ${lighten(theme.colors.brandAccent, 0.15)};
    filter: blur(80px);
  }
  .page-cover::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 4px;
    background: var(--highlight);
  }
  .cover-inner {
    position: relative;
    z-index: 1;
    padding: 0 60px;
  }
  .cover-title {
    font-size: 44px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.5px;
    margin-bottom: 16px;
  }
  .cover-accent {
    width: 80px;
    height: 4px;
    background: var(--highlight);
    margin: 20px 0;
    border-radius: 2px;
  }
  .cover-subtitle {
    font-size: 18px;
    font-weight: 400;
    color: ${lighten(theme.colors.white, 0.75)};
    line-height: 1.5;
    max-width: 600px;
  }
  .cover-brand {
    position: absolute;
    bottom: 40px;
    left: 60px;
    font-size: 11px;
    font-weight: 500;
    color: ${lighten(theme.colors.white, 0.5)};
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  /* ── CTA Page ─────────────────────────────────────────── */
  .page-cta {
    padding: 0;
    background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--white);
    text-align: center;
  }
  .page-cta::before {
    content: '';
    position: absolute;
    bottom: -80px; left: -80px;
    width: 280px; height: 280px;
    border-radius: 50%;
    background: ${lighten(theme.colors.brandAccent, 0.12)};
    filter: blur(60px);
  }
  .page-cta::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 4px;
    background: var(--highlight);
  }
  .cta-inner { position: relative; z-index: 1; }
  .cta-title {
    font-size: 40px;
    font-weight: 800;
    margin-bottom: 16px;
    letter-spacing: -0.5px;
  }
  .cta-accent {
    width: 60px; height: 4px;
    background: var(--highlight);
    margin: 0 auto 24px;
    border-radius: 2px;
  }
  .cta-desc {
    font-size: 16px;
    color: ${lighten(theme.colors.white, 0.75)};
    max-width: 580px;
    line-height: 1.6;
  }
  .cta-contact {
    font-size: 13px;
    color: ${lighten(theme.colors.white, 0.5)};
    margin-top: 32px;
  }

  /* ── Section Title ────────────────────────────────────── */
  .slide-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
    line-height: 1.2;
  }
  .accent-line {
    width: 60px;
    height: 3px;
    background: var(--brand-accent);
    border-radius: 2px;
    margin: 8px 0 20px;
  }

  /* ── Content Typography ───────────────────────────────── */
  .body-text {
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-light);
    margin-bottom: 16px;
  }

  .bullets { list-style: none; padding: 0; margin: 8px 0; }
  .bullets li {
    padding: 7px 0 7px 24px;
    position: relative;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
  }
  .bullets li::before {
    content: '';
    position: absolute;
    left: 4px; top: 14px;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--brand-accent);
  }

  /* ── Impact Box ───────────────────────────────────────── */
  .impact-box {
    background: color-mix(in srgb, var(--highlight) 8%, transparent);
    border-left: 3px solid var(--highlight);
    padding: 14px 18px;
    font-size: 13px;
    color: var(--text);
    font-weight: 500;
    border-radius: 0 8px 8px 0;
    margin: 16px 0;
    line-height: 1.5;
  }
  .impact-box strong {
    color: var(--highlight);
    font-weight: 700;
  }

  /* ── Feature Cards ────────────────────────────────────── */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 16px 0;
  }
  .feature-card {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    position: relative;
    overflow: hidden;
  }
  .feature-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--brand-accent);
  }
  .feature-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--brand-accent);
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .feature-text {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text);
  }

  /* ── Chart Container ──────────────────────────────────── */
  .chart-layout {
    display: flex;
    gap: 16px;
    margin-top: 4px;
  }
  .chart-main { flex: 1; }
  .chart-svg {
    width: 100%;
    max-height: 380px;
    display: block;
  }
  .insights-panel {
    flex: 0 0 220px;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }
  .insights-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--brand-accent);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .insight-item {
    font-size: 11px;
    color: var(--text);
    line-height: 1.5;
    padding: 8px 0 8px 14px;
    position: relative;
    border-bottom: 1px solid var(--border);
  }
  .insight-item:last-child { border-bottom: none; }
  .insight-item::before {
    content: '';
    position: absolute;
    left: 0; top: 14px;
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--brand-accent);
  }

  .diagram-svg, .wireframe-svg {
    width: 100%;
    max-height: 420px;
    display: block;
    margin: 8px auto;
  }

  /* ── Timeline ─────────────────────────────────────────── */
  .timeline-container {
    position: relative;
    margin: 32px 0 16px;
    padding: 0 20px;
  }
  .timeline-line {
    position: absolute;
    top: 18px; left: 20px; right: 20px;
    height: 3px;
    background: var(--brand-accent);
    border-radius: 2px;
  }
  .timeline-items {
    display: flex;
    position: relative;
  }
  .timeline-item {
    flex: 1;
    text-align: center;
    position: relative;
    padding: 0 6px;
  }
  .timeline-date {
    font-size: 11px;
    font-weight: 700;
    color: var(--brand-accent);
    margin-bottom: 10px;
  }
  .timeline-dot {
    width: 16px; height: 16px;
    background: var(--brand-accent);
    border: 3px solid var(--white);
    border-radius: 50%;
    margin: 0 auto 14px;
    box-shadow: 0 0 0 2px var(--brand-accent);
    position: relative;
    z-index: 2;
  }
  .timeline-card {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    margin-top: 8px;
  }
  .timeline-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
  }
  .timeline-desc {
    font-size: 10px;
    color: var(--text-light);
    line-height: 1.4;
  }

  /* ── Team ─────────────────────────────────────────────── */
  .team-grid {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin: 20px 0;
  }
  .team-card {
    flex: 0 0 22%;
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .team-header {
    background: var(--brand-primary);
    padding: 20px;
    text-align: center;
    position: relative;
  }
  .team-avatar {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: ${lighten(theme.colors.brandAccent, 0.3)};
    margin: 0 auto 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: var(--white);
  }
  .team-initials {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  .team-body { padding: 16px; text-align: center; }
  .team-name { font-size: 14px; font-weight: 700; color: var(--text); }
  .team-role { font-size: 11px; color: var(--brand-accent); margin: 4px 0 8px; font-weight: 500; }
  .team-divider { width: 40px; height: 1px; background: var(--border); margin: 0 auto 8px; }
  .team-bio { font-size: 10px; color: var(--text-light); line-height: 1.5; }

  /* ── Footer ───────────────────────────────────────────── */
  .footer {
    position: absolute;
    bottom: 10mm;
    left: 32mm;
    right: 16mm;
    font-size: 8px;
    color: var(--text-muted);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-line {
    flex: 1;
    height: 1px;
    background: var(--border);
    margin: 0 12px;
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
    total: number,
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
      <div class="cover-inner">
        <div class="cover-title">${this.esc(title)}</div>
        <div class="cover-accent"></div>
        ${slide.subtitle ? `<div class="cover-subtitle">${this.esc(slide.subtitle as string)}</div>` : ""}
      </div>
      <div class="cover-brand">Executive Vision Deck</div>`;
        break;

      case "executive_summary":
      case "solution_overview":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.description ? `<div class="body-text">${this.esc(slide.description as string)}</div>` : ""}
      ${(slide.keyFeatures as string[] ?? []).length ? `
      <div class="feature-grid">
        ${(slide.keyFeatures as string[]).map((f, i) => `
        <div class="feature-card">
          <div class="feature-num">${i + 1}</div>
          <div class="feature-text">${this.esc(f)}</div>
        </div>`).join("")}
      </div>` : ""}
      ${(slide.bullets as string[] ?? []).length ? `
      <ul class="bullets">
        ${(slide.bullets as string[]).map((b) => `<li>${this.esc(b)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;

      case "problem_statement":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.problem ? `<div class="body-text">${this.esc(slide.problem as string)}</div>` : ""}
      ${slide.impact ? `<div class="impact-box"><strong>Impacto:</strong> ${this.esc(slide.impact as string)}</div>` : ""}
      ${(slide.differentiators as string[] ?? []).length ? `
      <div style="margin-top:16px;font-size:12px;font-weight:600;color:${theme.colors.brandAccent};margin-bottom:8px;">Diferenciadores</div>
      <ul class="bullets">
        ${(slide.differentiators as string[]).map((d) => `<li>${this.esc(d)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;

      case "market_analysis":
      case "data_chart":
      case "financials": {
        const chartSvg = charts.get(slideId);
        const insights = (slide.insights as string[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="chart-layout">
        <div class="chart-main">
          ${chartSvg ? `<div class="chart-svg">${chartSvg}</div>` : ""}
        </div>
        ${insights.length ? `
        <div class="insights-panel">
          <div class="insights-title">Insights</div>
          ${insights.slice(0, 6).map((ins) => `<div class="insight-item">${this.esc(ins)}</div>`).join("\n          ")}
        </div>` : ""}
      </div>`;
        break;
      }

      case "architecture_diagram": {
        const diagSvg = diagrams.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${diagSvg ? `<div class="diagram-svg">${diagSvg}</div>` : ""}`;
        break;
      }

      case "wireframe": {
        const wfSvg = wireframes.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${wfSvg ? `<div class="wireframe-svg">${wfSvg}</div>` : ""}`;
        break;
      }

      case "timeline": {
        const milestones = (slide.milestones as { label: string; date: string; description: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="timeline-container">
        <div class="timeline-line"></div>
        <div class="timeline-items">
          ${milestones.map((m) => `
          <div class="timeline-item">
            <div class="timeline-date">${this.esc(m.date)}</div>
            <div class="timeline-dot"></div>
            <div class="timeline-card">
              <div class="timeline-label">${this.esc(m.label)}</div>
              <div class="timeline-desc">${this.esc(m.description)}</div>
            </div>
          </div>`).join("\n          ")}
        </div>
      </div>`;
        break;
      }

      case "team": {
        const members = (slide.members as { name: string; role: string; bio: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="team-grid">
        ${members.map((m) => {
          const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return `
        <div class="team-card">
          <div class="team-header">
            <div class="team-avatar"><div class="team-initials">${this.esc(initials)}</div></div>
          </div>
          <div class="team-body">
            <div class="team-name">${this.esc(m.name)}</div>
            <div class="team-role">${this.esc(m.role)}</div>
            <div class="team-divider"></div>
            <div class="team-bio">${this.esc(m.bio)}</div>
          </div>
        </div>`;
        }).join("\n")}
      </div>`;
        break;
      }

      case "cta":
        pageClass += " page-cta";
        content = `
      <div class="cta-inner">
        <div class="cta-title">${this.esc(title)}</div>
        <div class="cta-accent"></div>
        ${slide.description ? `<div class="cta-desc">${this.esc(slide.description as string)}</div>` : ""}
        ${slide.contactInfo ? `<div class="cta-contact">${this.esc(slide.contactInfo as string)}</div>` : ""}
      </div>`;
        break;

      default:
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${(slide.bullets as string[] ?? []).map((b) => `<div class="body-text" style="margin-bottom:4px;">${this.esc(b)}</div>`).join("\n")}`;
        break;
    }

    const isCover = pageClass.includes("page-cover");
    const isCta = pageClass.includes("page-cta");
    const footerHTML = (!isCover && !isCta) ? `
      <div class="footer">
        <span>Confidential</span>
        <div class="footer-line"></div>
        <span>${index + 1} / ${total}</span>
      </div>` : "";

    return `    <div class="${pageClass}">
      ${content}
      ${footerHTML}
    </div>`;
  }

  private esc(str: string): string {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
