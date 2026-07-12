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

  /* ── Value Proposition Box ────────────────────────────── */
  .value-box {
    background: color-mix(in srgb, var(--brand-accent) 8%, transparent);
    border-left: 3px solid var(--brand-accent);
    padding: 14px 18px;
    font-size: 13px;
    color: var(--text);
    font-weight: 500;
    border-radius: 0 8px 8px 0;
    margin: 16px 0;
    line-height: 1.5;
  }
  .value-box strong {
    color: var(--brand-accent);
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

  /* ── User Flows ───────────────────────────────────────── */
  .flow-section {
    margin-bottom: 16px;
  }
  .flow-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--brand-accent);
    margin-bottom: 4px;
  }
  .flow-desc {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 8px;
  }
  .flow-steps {
    display: flex;
    gap: 8px;
  }
  .flow-step {
    flex: 1;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .flow-step-num {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--brand-accent);
    color: var(--white);
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .flow-step-text {
    font-size: 11px;
    color: var(--text);
    line-height: 1.4;
  }
  .flow-arrow {
    display: flex;
    align-items: center;
    color: var(--brand-accent);
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* ── Feature Deep Dive ────────────────────────────────── */
  .feature-badge {
    display: inline-block;
    background: var(--brand-accent);
    color: var(--white);
    padding: 4px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .how-it-works {
    font-size: 12px;
    color: var(--text);
    line-height: 1.6;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    margin-top: 12px;
  }
  .how-it-works strong {
    color: var(--brand-accent);
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

  /* ── Data Model ───────────────────────────────────────── */
  .data-model-layout {
    display: flex;
    gap: 16px;
    margin-top: 4px;
  }
  .entity-table {
    flex: 1;
    border-collapse: collapse;
    font-size: 11px;
  }
  .entity-table th {
    background: var(--brand-primary);
    color: var(--white);
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }
  .entity-table td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .entity-table tr:nth-child(even) td {
    background: var(--bg-subtle);
  }
  .entity-name {
    font-weight: 700;
    color: var(--brand-accent);
  }
  .entity-fields {
    font-size: 10px;
    color: var(--text-muted);
    font-family: 'Fira Code', monospace;
  }

  /* ── Integration Cards ────────────────────────────────── */
  .integration-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 16px 0;
  }
  .integration-card {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-top: 3px solid var(--brand-accent);
    border-radius: 8px;
    padding: 14px;
  }
  .integration-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
  }
  .integration-type {
    display: inline-block;
    background: color-mix(in srgb, var(--brand-accent) 12%, transparent);
    color: var(--brand-accent);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .integration-purpose {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }
  .integration-provider {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 8px;
  }

  /* ── Security ─────────────────────────────────────────── */
  .security-badge {
    display: inline-block;
    background: color-mix(in srgb, var(--brand-accent) 10%, transparent);
    border: 1px solid var(--brand-accent);
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--brand-accent);
    margin-bottom: 16px;
  }
  .roles-row {
    display: flex;
    gap: 10px;
    margin: 12px 0;
  }
  .role-badge {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
  }

  /* ── Deployment ───────────────────────────────────────── */
  .deployment-phases {
    display: flex;
    gap: 12px;
    margin: 16px 0;
  }
  .deployment-phase {
    flex: 1;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    position: relative;
  }
  .phase-num {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--brand-accent);
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .phase-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 4px;
  }
  .phase-desc {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }
  .cicd-box {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    color: var(--text);
    margin-top: 12px;
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

      case "product_overview":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.description ? `<div class="body-text">${this.esc(slide.description as string)}</div>` : ""}
      ${slide.valueProposition ? `<div class="value-box"><strong>Propuesta de valor:</strong> ${this.esc(slide.valueProposition as string)}</div>` : ""}
      ${(slide.targetUsers as string[] ?? []).length ? `
      <div style="font-size:12px;font-weight:600;color:${theme.colors.brandAccent};margin-bottom:8px;">Usuarios objetivo</div>
      <ul class="bullets">
        ${(slide.targetUsers as string[]).map((u) => `<li>${this.esc(u)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;

      case "user_flows": {
        const flows = (slide.flows as { name: string; steps: string[]; description?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${flows.map((flow) => `
      <div class="flow-section">
        <div class="flow-name">${this.esc(flow.name)}</div>
        ${flow.description ? `<div class="flow-desc">${this.esc(flow.description)}</div>` : ""}
        <div class="flow-steps">
          ${flow.steps.slice(0, 4).map((step, si) => `
          ${si > 0 ? '<div class="flow-arrow">→</div>' : ""}
          <div class="flow-step">
            <div class="flow-step-num">${si + 1}</div>
            <div class="flow-step-text">${this.esc(step)}</div>
          </div>`).join("")}
        </div>
      </div>`).join("")}`;
        break;
      }

      case "feature_deep_dive":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.featureName ? `<div class="feature-badge">${this.esc(slide.featureName as string)}</div>` : ""}
      ${slide.description ? `<div class="body-text">${this.esc(slide.description as string)}</div>` : ""}
      ${(slide.benefits as string[] ?? []).length ? `
      <div style="font-size:12px;font-weight:600;color:${theme.colors.brandAccent};margin-bottom:8px;">Beneficios</div>
      <ul class="bullets">
        ${(slide.benefits as string[]).map((b) => `<li>${this.esc(b)}</li>`).join("\n        ")}
      </ul>` : ""}
      ${slide.howItWorks ? `<div class="how-it-works"><strong>Cómo funciona:</strong> ${this.esc(slide.howItWorks as string)}</div>` : ""}`;
        break;

      case "data_chart": {
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

      case "data_model": {
        const entities = (slide.entities as { name: string; fields: string[]; description?: string }[]) ?? [];
        const erSvg = diagrams.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="data-model-layout">
        ${erSvg ? `<div class="diagram-svg" style="flex:0 0 48%">${erSvg}</div>` : ""}
        ${entities.length ? `
        <table class="entity-table" style="${erSvg ? 'flex:1' : 'width:100%'}">
          <thead>
            <tr><th>Entidad</th><th>Campos</th><th>Descripción</th></tr>
          </thead>
          <tbody>
            ${entities.map((e) => `
            <tr>
              <td class="entity-name">${this.esc(e.name)}</td>
              <td class="entity-fields">${this.esc(e.fields.join(", "))}</td>
              <td>${this.esc(e.description ?? "")}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : ""}
      </div>`;
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

      case "integration_points": {
        const integrations = (slide.integrations as { name: string; type?: string; purpose?: string; provider?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="integration-grid">
        ${integrations.map((intg) => `
        <div class="integration-card">
          <div class="integration-name">${this.esc(intg.name)}</div>
          ${intg.type ? `<div class="integration-type">${this.esc(intg.type)}</div>` : ""}
          ${intg.purpose ? `<div class="integration-purpose">${this.esc(intg.purpose)}</div>` : ""}
          ${intg.provider ? `<div class="integration-provider">Provider: ${this.esc(intg.provider)}</div>` : ""}
        </div>`).join("")}
      </div>`;
        break;
      }

      case "security_model":
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.authMethod ? `<div class="security-badge">Autenticación: ${this.esc(slide.authMethod as string)}</div>` : ""}
      ${(slide.roles as string[] ?? []).length ? `
      <div style="font-size:12px;font-weight:600;color:${theme.colors.brandAccent};margin-bottom:8px;">Roles del sistema</div>
      <div class="roles-row">
        ${(slide.roles as string[]).map((r) => `<div class="role-badge">${this.esc(r)}</div>`).join("")}
      </div>` : ""}
      ${(slide.dataProtection as string[] ?? []).length ? `
      <div style="font-size:12px;font-weight:600;color:${theme.colors.brandAccent};margin:16px 0 8px;">Protección de datos</div>
      <ul class="bullets">
        ${(slide.dataProtection as string[]).map((p) => `<li>${this.esc(p)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;

      case "deployment_plan": {
        const phases = (slide.phases as { label: string; description?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.environment ? `<div class="security-badge">Entorno: ${this.esc(slide.environment as string)}</div>` : ""}
      ${phases.length ? `
      <div class="deployment-phases">
        ${phases.map((p, i) => `
        <div class="deployment-phase">
          <div class="phase-num">${i + 1}</div>
          <div class="phase-label">${this.esc(p.label)}</div>
          ${p.description ? `<div class="phase-desc">${this.esc(p.description)}</div>` : ""}
        </div>`).join("")}
      </div>` : ""}
      ${slide.ciCd ? `<div class="cicd-box"><strong>CI/CD:</strong> ${this.esc(slide.ciCd as string)}</div>` : ""}`;
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
