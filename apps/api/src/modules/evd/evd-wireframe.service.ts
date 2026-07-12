import { Injectable } from "@nestjs/common";
import type { EvdDesignTheme } from "./evd-design-system.js";

export interface WireframeComponent {
  type: string;
  label: string;
  width?: string;
  height?: string;
  x?: number;
  y?: number;
}

export interface WireframeData {
  screenName: string;
  components: WireframeComponent[];
  layout?: string;
  columns?: number;
}

@Injectable()
export class EvdWireframeService {
  /** Generate a lo-fi Balsamiq-style wireframe SVG from component tree. */
  renderWireframeSVG(data: WireframeData, theme: EvdDesignTheme): string {
    const W = 800;
    const H = 520;
    const PAD = 16;
    const HEADER_H = 36;
    const NAVBAR_H = 44;
    const SIDEBAR_W = 180;

    const rects: string[] = [];

    // Screen label
    rects.push(
      `<text x="${PAD}" y="18" font-size="11" font-weight="600" fill="${theme.colors.textLight}" font-family="${theme.typography.family}" font-style="italic">${data.screenName}</text>`,
    );

    // Phone frame
    rects.push(
      `<rect x="${PAD}" y="${HEADER_H}" width="${W - PAD * 2}" height="${H - HEADER_H - PAD}" fill="#FAFAFA" stroke="${theme.colors.border}" stroke-width="1.5" rx="8"/>`,
    );

    let cursorY = HEADER_H + PAD;
    let cursorX = PAD + 8;
    const contentW = W - PAD * 2 - 16;

    for (const comp of data.components) {
      const cw = this.parseWidth(comp.width, contentW);
      const ch = this.parseHeight(comp.height, 80);

      switch (comp.type) {
        case "navbar":
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${contentW}" height="${NAVBAR_H}" fill="#374151" rx="4"/>`,
            `<circle cx="${cursorX + 20}" cy="${cursorY + NAVBAR_H / 2}" r="8" fill="#6B7280"/>`,
            `<rect x="${cursorX + 40}" y="${cursorY + 14}" width="120" height="10" fill="#9CA3AF" rx="2"/>`,
            `<rect x="${cursorX + contentW - 60}" y="${cursorY + 12}" width="48" height="20" fill="#6B7280" rx="4"/>`,
          );
          cursorY += NAVBAR_H + 12;
          break;

        case "sidebar":
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${SIDEBAR_W}" height="${H - cursorY - PAD - 20}" fill="#E5E7EB" rx="4"/>`,
          );
          for (let r = 0; r < 5; r++) {
            const ry = cursorY + 16 + r * 28;
            rects.push(`<rect x="${cursorX + 12}" y="${ry}" width="${SIDEBAR_W - 24}" height="14" fill="#D1D5DB" rx="2"/>`);
          }
          cursorX += SIDEBAR_W + 12;
          break;

        case "card":
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${cw}" height="${ch}" fill="#FFFFFF" stroke="${theme.colors.border}" stroke-width="1" rx="6" filter="url(#cardShadow)"/>`,
            `<rect x="${cursorX + 12}" y="${cursorY + 12}" width="${cw * 0.5}" height="10" fill="#D1D5DB" rx="2"/>`,
            `<rect x="${cursorX + 12}" y="${cursorY + ch - 24}" width="${cw * 0.3}" height="10" fill="${theme.colors.brandPrimary}40" rx="2"/>`,
          );
          cursorX += cw + 12;
          break;

        case "table":
          const rows = 4;
          const rowH = 28;
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${contentW}" height="${HEADER_H + rows * rowH}" fill="#FFFFFF" stroke="${theme.colors.border}" stroke-width="1" rx="4"/>`,
            `<rect x="${cursorX}" y="${cursorY}" width="${contentW}" height="${HEADER_H}" fill="#F3F4F6" rx="4"/>`,
          );
          for (let r = 0; r < rows; r++) {
            const ry = cursorY + HEADER_H + r * rowH;
            rects.push(`<rect x="${cursorX + 8}" y="${ry + 6}" width="60" height="8" fill="#D1D5DB" rx="2"/>`);
            rects.push(`<rect x="${cursorX + contentW * 0.3}" y="${ry + 6}" width="80" height="8" fill="#D1D5DB" rx="2"/>`);
            rects.push(`<rect x="${cursorX + contentW * 0.65}" y="${ry + 6}" width="50" height="8" fill="#D1D5DB" rx="2"/>`);
          }
          cursorY += HEADER_H + rows * rowH + 12;
          break;

        case "form":
          const fields = 3;
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${Math.min(cw, contentW)}" height="${fields * 52 + 24}" fill="#FFFFFF" stroke="${theme.colors.border}" stroke-width="1" rx="6"/>`,
          );
          for (let f = 0; f < fields; f++) {
            const fy = cursorY + 16 + f * 52;
            rects.push(`<text x="${cursorX + 12}" y="${fy}" font-size="10" fill="${theme.colors.textLight}" font-family="${theme.typography.family}">Label ${f + 1}</text>`);
            rects.push(`<rect x="${cursorX + 12}" y="${fy + 4}" width="${Math.min(cw, contentW) - 24}" height="28" fill="#FFFFFF" stroke="${theme.colors.border}" stroke-width="1" rx="4"/>`);
          }
          cursorY += fields * 52 + 36;
          break;

        case "chart":
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${contentW}" height="${ch}" fill="#FFFFFF" stroke="${theme.colors.border}" stroke-width="1" rx="6"/>`,
            `<line x1="${cursorX + 40}" y1="${cursorY + ch - 24}" x2="${cursorX + contentW - 20}" y2="${cursorY + ch - 24}" stroke="${theme.colors.border}" stroke-width="1"/>`,
          );
          // Bar chart placeholder
          const bars = 5;
          const barGap = (contentW - 80) / bars;
          for (let b = 0; b < bars; b++) {
            const bh = 30 + Math.random() * (ch - 80);
            const bx = cursorX + 50 + b * barGap;
            rects.push(`<rect x="${bx}" y="${cursorY + ch - 24 - bh}" width="${barGap * 0.6}" height="${bh}" fill="${theme.colors.brandPrimary}60" rx="3"/>`);
          }
          cursorY += ch + 12;
          break;

        case "button":
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${Math.min(cw, 160)}" height="32" fill="${theme.colors.brandPrimary}" rx="6"/>`,
            `<text x="${cursorX + Math.min(cw, 160) / 2}" y="${cursorY + 20}" text-anchor="middle" font-size="11" fill="#FFFFFF" font-family="${theme.typography.family}" font-weight="600">${comp.label}</text>`,
          );
          cursorY += 44;
          break;

        default:
          rects.push(
            `<rect x="${cursorX}" y="${cursorY}" width="${cw}" height="${ch}" fill="#F9FAFB" stroke="${theme.colors.border}" stroke-width="1" stroke-dasharray="4,4" rx="4"/>`,
            `<text x="${cursorX + cw / 2}" y="${cursorY + ch / 2 + 4}" text-anchor="middle" font-size="10" fill="${theme.colors.textLight}" font-family="${theme.typography.family}" font-style="italic">${comp.label}</text>`,
          );
          cursorY += ch + 12;
          break;
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="cardShadow" x="-2%" y="-2%" width="104%" height="104%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.06"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="transparent"/>
  ${rects.join("\n  ")}
</svg>`;
  }

  private parseWidth(w: string | undefined, fallback: number): number {
    if (!w) return fallback;
    if (w.endsWith("%")) return (parseFloat(w) / 100) * fallback;
    if (w.endsWith("px")) return parseFloat(w);
    return fallback;
  }

  private parseHeight(h: string | undefined, fallback: number): number {
    if (!h) return fallback;
    if (h.endsWith("px")) return parseFloat(h);
    if (h.includes("calc")) return fallback;
    return fallback;
  }
}
