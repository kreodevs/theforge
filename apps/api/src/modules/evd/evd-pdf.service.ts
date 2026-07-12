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
  ): Promise<Buffer> {
    const theme = buildTheme(deck.branding as Record<string, unknown> | null);

    const html = this.buildHTML(deck, theme, renderedCharts, renderedDiagrams);

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
  ): string {
    const total = deck.slides?.length ?? 0;
    const slidesHTML = (deck.slides ?? [])
      .map((slide, i) => this.slideToHTML(slide, i, total, theme, charts, diagrams))
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
    --neutral: ${theme.colors.neutral};
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
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .page-with-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.85);
    z-index: 0;
  }
  .slide-illustration {
    position: absolute;
    bottom: 14mm;
    right: 16mm;
    width: 40mm;
    height: 30mm;
    object-fit: contain;
    z-index: 1;
    opacity: 0.9;
  }
  .page > * { position: relative; z-index: 1; }
  .cover-inner > * { position: relative; z-index: 1; }
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

  /* ── Callout Box (impact / urgency / improvement) ─────── */
  .callout-box {
    display: inline-block;
    padding: 10px 16px;
    font-size: 13px;
    color: var(--text);
    font-weight: 500;
    border-radius: 0 8px 8px 0;
    margin: 8px 0;
    line-height: 1.5;
    border-left: 3px solid;
  }
  .callout-box strong { font-weight: 700; }
  .callout-negative { background: color-mix(in srgb, var(--negative) 6%, transparent); border-color: var(--negative); }
  .callout-negative strong { color: var(--negative); }
  .callout-accent { background: color-mix(in srgb, var(--brand-accent) 8%, transparent); border-color: var(--brand-accent); }
  .callout-accent strong { color: var(--brand-accent); }
  .callout-positive { background: color-mix(in srgb, var(--positive) 6%, transparent); border-color: var(--positive); }
  .callout-positive strong { color: var(--positive); }
  .callout-highlight { background: color-mix(in srgb, var(--highlight) 6%, transparent); border-color: var(--highlight); }
  .callout-highlight strong { color: var(--highlight); }

  /* ── Two Column Layout ────────────────────────────────── */
  .two-col {
    display: flex;
    gap: 20px;
    margin: 12px 0;
  }
  .col-card {
    flex: 1;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    position: relative;
    overflow: hidden;
  }
  .col-card-header {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid;
  }
  .col-card.negative .col-card-header { color: var(--negative); border-color: var(--negative); }
  .col-card.positive .col-card-header { color: var(--brand-accent); border-color: var(--brand-accent); }
  .col-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: var(--highlight);
    flex-shrink: 0;
    width: 40px;
  }

  /* ── Process Flow Steps ───────────────────────────────── */
  .flow-steps {
    display: flex;
    gap: 10px;
    margin: 12px 0;
  }
  .flow-step {
    flex: 1;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    position: relative;
    overflow: hidden;
  }
  .flow-step.automated { border-color: var(--positive); }
  .flow-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--brand-accent);
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .flow-step-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 4px;
  }
  .flow-step-desc {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }
  .automated-badge {
    display: inline-block;
    background: color-mix(in srgb, var(--positive) 12%, transparent);
    color: var(--positive);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 600;
    margin-top: 6px;
  }
  .flow-arrow {
    display: flex;
    align-items: center;
    color: var(--brand-accent);
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* ── Automation Cards ─────────────────────────────────── */
  .auto-card {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-left: 3px solid var(--positive);
    border-radius: 0 8px 8px 0;
    padding: 12px 14px;
    margin-bottom: 10px;
  }
  .auto-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
  .auto-desc {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
    margin-top: 4px;
  }
  .auto-time {
    display: inline-block;
    background: color-mix(in srgb, var(--positive) 12%, transparent);
    color: var(--positive);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-top: 6px;
  }

  /* ── Feature Grid ─────────────────────────────────────── */
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
  .feature-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 6px;
  }
  .feature-desc {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }
  .feature-benefit {
    font-size: 10px;
    color: var(--positive);
    font-weight: 600;
    margin-top: 8px;
  }

  /* ── Data Overview ────────────────────────────────────── */
  .data-layout {
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
  .sens-high { color: var(--negative); font-weight: 700; }
  .sens-medium { color: var(--highlight); font-weight: 700; }
  .sens-low { color: var(--positive); font-weight: 700; }
  .flow-item {
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  .flow-item:last-child { border-bottom: none; }
  .flow-from { font-weight: 700; color: var(--brand-accent); }
  .flow-to { font-weight: 700; color: var(--brand-accent); }
  .flow-arrow-inline { color: var(--highlight); font-weight: 700; margin: 0 6px; }
  .flow-desc { font-size: 10px; color: var(--text-light); margin-top: 2px; }

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
  .direction-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .direction-inbound { background: color-mix(in srgb, var(--brand-accent) 12%, transparent); color: var(--brand-accent); }
  .direction-outbound { background: color-mix(in srgb, var(--positive) 12%, transparent); color: var(--positive); }
  .direction-bidirectional { background: color-mix(in srgb, var(--highlight) 12%, transparent); color: var(--highlight); }
  .integration-purpose {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }

  /* ── Security & Access ────────────────────────────────── */
  .role-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin: 12px 0;
  }
  .role-card {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
  }
  .role-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--brand-accent);
    margin-bottom: 6px;
  }
  .role-perms {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }

  /* ── Rollout Plan ─────────────────────────────────────── */
  .rollout-phases {
    display: flex;
    gap: 12px;
    margin: 16px 0;
  }
  .rollout-phase {
    flex: 1;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-top: 3px solid var(--brand-accent);
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
    display: inline-flex;
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
  .phase-duration {
    display: inline-block;
    background: color-mix(in srgb, var(--highlight) 12%, transparent);
    color: var(--highlight);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .phase-desc {
    font-size: 11px;
    color: var(--text-light);
    line-height: 1.5;
  }
  .success-criteria {
    background: color-mix(in srgb, var(--positive) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--positive) 20%, transparent);
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 12px;
  }
  .success-criteria-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--positive);
    margin-bottom: 8px;
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

  /* ── Diagram ──────────────────────────────────────────── */
  .diagram-svg {
    width: 100%;
    max-height: 420px;
    display: block;
    margin: 8px auto;
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
    _theme: EvdDesignTheme,
    charts: Map<string, string>,
    diagrams: Map<string, string>,
  ): string {
    const type = (slide.type as string)?.toLowerCase() ?? "fallback";
    const title = (slide.title as string) ?? "";
    const slideId = (slide.id as string) ?? `slide-${index}`;
    const backgroundB64 = slide.backgroundB64 as string | undefined;
    const illustrationB64 = slide.illustrationB64 as string | undefined;

    let pageClass = "page";
    let pageStyle = "";
    if (backgroundB64) {
      pageStyle = ` style="background-image:url('data:image/png;base64,${backgroundB64}')"`;
      pageClass += " page-with-bg";
    }

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

      case "problem_statement": {
        const painPoints = (slide.painPoints as string[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${painPoints.length ? `
      <div style="font-size:12px;font-weight:600;color:var(--brand-accent);margin-bottom:8px;">Puntos de dolor</div>
      <ul class="bullets">
        ${painPoints.map((p) => `<li>${this.esc(p)}</li>`).join("\n        ")}
      </ul>` : ""}
      ${slide.impact ? `<div class="callout-box callout-negative"><strong>Impacto:</strong> ${this.esc(slide.impact as string)}</div>` : ""}
      ${slide.urgency ? `<div class="callout-box callout-highlight"><strong>Urgencia:</strong> ${this.esc(slide.urgency as string)}</div>` : ""}`;
        break;
      }

      case "solution_vision": {
        const outcomes = (slide.keyOutcomes as string[]) ?? [];
        const users = (slide.targetUsers as string[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${slide.description ? `<div class="body-text">${this.esc(slide.description as string)}</div>` : ""}
      ${outcomes.length ? `
      <div class="callout-box callout-accent"><strong>Resultados esperados</strong></div>
      <ul class="bullets">
        ${outcomes.map((o) => `<li>${this.esc(o)}</li>`).join("\n        ")}
      </ul>` : ""}
      ${users.length ? `
      <div style="font-size:12px;font-weight:600;color:var(--brand-accent);margin-bottom:8px;">Usuarios objetivo</div>
      <ul class="bullets">
        ${users.map((u) => `<li>${this.esc(u)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;
      }

      case "current_vs_new": {
        const currentSteps = (slide.currentSteps as string[]) ?? [];
        const newSteps = (slide.newSteps as string[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="two-col">
        <div class="col-card negative">
          <div class="col-card-header">${this.esc((slide.currentLabel as string) ?? "Situación actual")}</div>
          <ol style="padding-left:18px;margin:0;">
            ${currentSteps.map((s) => `<li style="font-size:12px;color:var(--text);padding:4px 0;line-height:1.5;">${this.esc(s)}</li>`).join("\n            ")}
          </ol>
        </div>
        <div class="col-arrow">→</div>
        <div class="col-card positive">
          <div class="col-card-header">${this.esc((slide.newLabel as string) ?? "Proceso nuevo")}</div>
          <ol style="padding-left:18px;margin:0;">
            ${newSteps.map((s) => `<li style="font-size:12px;color:var(--text);padding:4px 0;line-height:1.5;">${this.esc(s)}</li>`).join("\n            ")}
          </ol>
        </div>
      </div>
      ${slide.improvementSummary ? `<div class="callout-box callout-positive"><strong>Mejora:</strong> ${this.esc(slide.improvementSummary as string)}</div>` : ""}`;
        break;
      }

      case "process_flow": {
        const steps = (slide.steps as { label: string; description?: string; automated?: boolean }[]) ?? [];
        const diagSvg = diagrams.get(slideId);
        if (diagSvg) {
          content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="diagram-svg">${diagSvg}</div>`;
        } else {
          content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="flow-steps">
        ${steps.slice(0, 4).map((step, si) => `
        ${si > 0 ? '<div class="flow-arrow">→</div>' : ""}
        <div class="flow-step${step.automated ? ' automated' : ''}">
          <div class="flow-step-num">${si + 1}</div>
          <div class="flow-step-label">${this.esc(step.label)}</div>
          ${step.description ? `<div class="flow-step-desc">${this.esc(step.description)}</div>` : ""}
          ${step.automated ? '<div class="automated-badge">Automático</div>' : ""}
        </div>`).join("")}
      </div>`;
        }
        break;
      }

      case "automations": {
        const automations = (slide.automations as { name: string; description?: string; timeSaved?: string }[]) ?? [];
        const chartSvg = charts.get(slideId);
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div style="display:flex;gap:16px;">
        <div style="${chartSvg ? 'flex:0 0 50%' : 'width:100%'}">
          ${automations.map((a) => `
          <div class="auto-card">
            <div class="auto-name">${this.esc(a.name)}</div>
            ${a.description ? `<div class="auto-desc">${this.esc(a.description)}</div>` : ""}
            ${a.timeSaved ? `<div class="auto-time">${this.esc(a.timeSaved)}</div>` : ""}
          </div>`).join("")}
        </div>
        ${chartSvg ? `<div style="flex:1;display:flex;align-items:center;">${chartSvg}</div>` : ""}
      </div>`;
        break;
      }

      case "key_features": {
        const features = (slide.features as { name: string; description?: string; benefit?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="feature-grid">
        ${features.slice(0, 6).map((f, i) => `
        <div class="feature-card">
          <div class="feature-num">${i + 1}</div>
          <div class="feature-name">${this.esc(f.name)}</div>
          ${f.description ? `<div class="feature-desc">${this.esc(f.description)}</div>` : ""}
          ${f.benefit ? `<div class="feature-benefit">Beneficio: ${this.esc(f.benefit)}</div>` : ""}
        </div>`).join("")}
      </div>`;
        break;
      }

      case "data_overview": {
        const dataTypes = (slide.dataTypes as { name: string; description?: string; sensitivity?: string }[]) ?? [];
        const flows = (slide.flows as { from: string; to: string; description?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="data-layout">
        ${dataTypes.length ? `
        <table class="entity-table" style="${flows.length ? 'flex:0 0 55%' : 'width:100%'}">
          <thead><tr><th>Tipo de dato</th><th>Descripción</th><th>Sensibilidad</th></tr></thead>
          <tbody>
            ${dataTypes.map((dt) => `
            <tr>
              <td style="font-weight:700;">${this.esc(dt.name)}</td>
              <td>${this.esc(dt.description ?? "")}</td>
              <td class="sens-${dt.sensitivity ?? 'low'}">${this.esc(dt.sensitivity ?? "low")}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : ""}
        ${flows.length ? `
        <div style="${dataTypes.length ? 'flex:1' : 'width:100%'}">
          <div style="font-size:12px;font-weight:700;color:var(--brand-accent);margin-bottom:12px;">Flujos de datos</div>
          ${flows.map((f) => `
          <div class="flow-item">
            <div><span class="flow-from">${this.esc(f.from)}</span><span class="flow-arrow-inline">→</span><span class="flow-to">${this.esc(f.to)}</span></div>
            ${f.description ? `<div class="flow-desc">${this.esc(f.description)}</div>` : ""}
          </div>`).join("")}
        </div>` : ""}
      </div>`;
        break;
      }

      case "integrations": {
        const integrations = (slide.integrations as { name: string; purpose?: string; direction?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="integration-grid">
        ${integrations.map((intg) => `
        <div class="integration-card">
          <div class="integration-name">${this.esc(intg.name)}</div>
          <div class="direction-badge direction-${intg.direction ?? 'outbound'}">${this.esc(intg.direction ?? "outbound")}</div>
          ${intg.purpose ? `<div class="integration-purpose">${this.esc(intg.purpose)}</div>` : ""}
        </div>`).join("")}
      </div>`;
        break;
      }

      case "security_access": {
        const roles = (slide.roles as { name: string; permissions?: string[] }[]) ?? [];
        const dataProtection = (slide.dataProtection as string[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${roles.length ? `
      <div style="font-size:12px;font-weight:600;color:var(--brand-accent);margin-bottom:8px;">Roles y permisos</div>
      <div class="role-grid">
        ${roles.map((r) => `
        <div class="role-card">
          <div class="role-name">${this.esc(r.name)}</div>
          ${r.permissions?.length ? `<div class="role-perms">${this.esc(r.permissions.join(" · "))}</div>` : ""}
        </div>`).join("")}
      </div>` : ""}
      ${dataProtection.length ? `
      <div style="font-size:12px;font-weight:600;color:var(--brand-accent);margin:16px 0 8px;">Protección de datos</div>
      <ul class="bullets">
        ${dataProtection.map((p) => `<li>${this.esc(p)}</li>`).join("\n        ")}
      </ul>` : ""}`;
        break;
      }

      case "rollout_plan": {
        const phases = (slide.phases as { label: string; description?: string; duration?: string }[]) ?? [];
        const criteria = (slide.successCriteria as string[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      ${phases.length ? `
      <div class="rollout-phases">
        ${phases.map((p, i) => `
        <div class="rollout-phase">
          <div class="phase-num">${i + 1}</div>
          <div class="phase-label">${this.esc(p.label)}</div>
          ${p.duration ? `<div class="phase-duration">${this.esc(p.duration)}</div>` : ""}
          ${p.description ? `<div class="phase-desc">${this.esc(p.description)}</div>` : ""}
        </div>`).join("")}
      </div>` : ""}
      ${criteria.length ? `
      <div class="success-criteria">
        <div class="success-criteria-title">Criterios de éxito</div>
        <ul class="bullets" style="margin:0;">
          ${criteria.map((c) => `<li>${this.esc(c)}</li>`).join("\n          ")}
        </ul>
      </div>` : ""}`;
        break;
      }

      case "timeline": {
        const milestones = (slide.milestones as { label: string; date?: string; description?: string }[]) ?? [];
        content = `
      <div class="slide-title">${this.esc(title)}</div>
      <div class="accent-line"></div>
      <div class="timeline-container">
        <div class="timeline-line"></div>
        <div class="timeline-items">
          ${milestones.map((m) => `
          <div class="timeline-item">
            ${m.date ? `<div class="timeline-date">${this.esc(m.date)}</div>` : ""}
            <div class="timeline-dot"></div>
            <div class="timeline-card">
              <div class="timeline-label">${this.esc(m.label)}</div>
              ${m.description ? `<div class="timeline-desc">${this.esc(m.description)}</div>` : ""}
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
      ${(slide.bullets as string[] ?? []).map((b) => `<div class="body-text" style="margin-bottom:4px;">${this.esc(b)}</div>`).join("\n")}
      ${slide.description ? `<div class="body-text">${this.esc(slide.description as string)}</div>` : ""}`;
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

    const illustrationHTML = illustrationB64
      ? `<img src="data:image/png;base64,${illustrationB64}" class="slide-illustration" alt="Illustration" />`
      : "";

    return `    <div class="${pageClass}"${pageStyle}>
      ${content}
      ${illustrationHTML}
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
