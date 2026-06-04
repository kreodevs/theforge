import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPreviewTheme,
  generateColorScale,
  isLightColor,
  mergeDesignTokenColors,
  normalizeDesignTokenColors,
  parseCssColor,
  pickReadableTextColor,
  toHexColor,
} from "./design-system-utils.js";
import type { DesignTokens } from "./design-system-types.js";

describe("design-system-utils colors", () => {
  it("parseCssColor handles rgb() from Orbita", () => {
    const rgb = parseCssColor("rgb(44, 52, 54)");
    assert.deepEqual(rgb, { r: 44, g: 52, b: 54 });
    assert.equal(toHexColor("rgb(54, 88, 194)"), "#3658C2");
    assert.equal(toHexColor("rgb(247, 247, 250)"), "#F7F7FA");
  });

  it("isLightColor works for rgb strings", () => {
    assert.equal(isLightColor("rgb(247, 247, 250)"), true);
    assert.equal(isLightColor("rgb(44, 52, 54)"), false);
  });

  it("generateColorScale produces distinct steps from rgb neutral", () => {
    const scale = generateColorScale("rgb(247, 247, 250)", 12, "light");
    assert.equal(scale.length, 12);
    assert.notEqual(scale[0], scale[10]);
    assert.equal(isLightColor(scale[10]!), false);
  });

  it("buildPreviewTheme light mode has readable card muted text on white cards", () => {
    const tokens: DesignTokens = {
      colors: {
        primary: "rgb(54, 88, 194)",
        secondary: "rgb(243, 69, 62)",
        tertiary: "rgb(33, 199, 94)",
        foreground: "rgb(44, 52, 54)",
        background: "rgb(247, 247, 250)",
        muted: "rgb(247, 247, 250)",
        border: "rgb(199, 199, 204)",
      },
    };
    const theme = buildPreviewTheme(tokens, "light");
    const cardMuted = theme.cssVars["--ds-card-muted-fg"]!;
    const card = theme.cssVars["--ds-card"]!;
    assert.ok(contrastRatio(cardMuted, card) >= 3, `card-muted contrast too low: ${cardMuted} on ${card}`);
  });

  it("mergeDesignTokenColors: markdown ## Colors overrides stale YAML primary", () => {
    const merged = mergeDesignTokenColors(
      { primary: "#3B82F6", neutral: "#E2ECFE" },
      { primary: "#182A4A", secondary: "#1E6F4F" },
    );
    assert.equal(merged?.primary, "#182A4A");
    assert.equal(merged?.secondary, "#1E6F4F");
    assert.equal(merged?.neutral, "#E2ECFE");
  });

  it("buildPreviewTheme dark mode derives canvas background from gray scale when token is light", () => {
    const tokens: DesignTokens = {
      colors: {
        primary: "#182A4A",
        background: "#FFFFFF",
        muted: "#F5F6FA",
      },
    };
    const theme = buildPreviewTheme(tokens, "dark");
    assert.notEqual(theme.background, "#FFFFFF");
    assert.equal(isLightColor(theme.background), false);
    assert.equal(theme.cssVars["--ds-bg"], theme.background);
  });

  it("buildPreviewTheme dark mode keeps explicit dark background token", () => {
    const tokens: DesignTokens = {
      colors: {
        primary: "#182A4A",
        background: "#1A1C1E",
        muted: "#2C2C2E",
      },
    };
    const theme = buildPreviewTheme(tokens, "dark");
    assert.equal(theme.background, "#1A1C1E");
  });

  it("buildPreviewTheme dark keeps readable card text when Card component token sets dark textColor", () => {
    const tokens: DesignTokens = {
      colors: {
        primary: "#0F2B4A",
        foreground: "#1E2024",
        background: "#FFFFFF",
        muted: "#DBDFE4",
      },
      components: {
        Card: { backgroundColor: "#FFFFFF", textColor: "#1E2024" },
      },
    };
    const theme = buildPreviewTheme(tokens, "dark");
    assert.ok(
      contrastRatio(theme.cssVars["--ds-card-fg"]!, theme.cssVars["--ds-card"]!) >= 4.5,
      `card text should contrast with card surface: ${theme.cssVars["--ds-card-fg"]} on ${theme.cssVars["--ds-card"]}`,
    );
  });

  it("pickReadableTextColor prefers dark text on light swatches", () => {
    assert.match(pickReadableTextColor("#F4F5F8"), /rgba\(0,/);
    assert.match(pickReadableTextColor("#1A1C1E"), /rgba\(255,/);
  });
});

function contrastRatio(fg: string, bg: string): number {
  const parse = (c: string) => {
    const m = c.match(/^#([A-F0-9]{6})$/i);
    if (!m) return null;
    const h = m[1]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  };
  const lum = (r: number, g: number, b: number) => {
    const ch = (x: number) => {
      const s = x / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  };
  const fgRgb = parse(fg);
  const bgRgb = parse(bg);
  if (!fgRgb || !bgRgb) return 0;
  const l1 = lum(fgRgb.r, fgRgb.g, fgRgb.b);
  const l2 = lum(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
