import type { DesignTokens, TypographyToken } from "@/components/design-system-types";

export type PreviewMode = "light" | "dark";

export interface PreviewTheme {
  mode: PreviewMode;
  accent: string;
  gray: string;
  background: string;
  cssVars: Record<string, string>;
}

export function resolveRef(value: string, tokens: DesignTokens): string {
  const match = value.match(/^\{([\w.]+)\}$/);
  if (!match) return value;
  const parts = match[1]!.split(".");
  let obj: unknown = tokens;
  for (const part of parts) {
    if (obj && typeof obj === "object" && part in obj) {
      obj = (obj as Record<string, unknown>)[part];
    } else {
      return value;
    }
  }
  return typeof obj === "string" ? obj : value;
}

/** Parse #hex, bare hex, rgb(), rgba() into sRGB channels. */
export function parseCssColor(input: string): { r: number; g: number; b: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("#")) {
    let h = trimmed.slice(1);
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 6 && /^[A-Fa-f0-9]{6}$/.test(h)) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
      };
    }
    return null;
  }

  if (/^[A-Fa-f0-9]{6}$/.test(trimmed)) {
    return {
      r: parseInt(trimmed.slice(0, 2), 16),
      g: parseInt(trimmed.slice(2, 4), 16),
      b: parseInt(trimmed.slice(4, 6), 16),
    };
  }

  if (/^[A-Fa-f0-9]{3}$/.test(trimmed)) {
    return {
      r: parseInt(trimmed[0]! + trimmed[0]!, 16),
      g: parseInt(trimmed[1]! + trimmed[1]!, 16),
      b: parseInt(trimmed[2]! + trimmed[2]!, 16),
    };
  }

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1])))),
      g: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2])))),
      b: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3])))),
    };
  }

  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Normalize any supported CSS color to #RRGGBB (Orbita MCP emits rgb()). */
export function toHexColor(input: string, fallback = "#808080"): string {
  const parsed = parseCssColor(input);
  if (parsed) return rgbToHex(parsed.r, parsed.g, parsed.b);
  return fallback;
}

export function hexValue(value: string, tokens: DesignTokens): string {
  const resolved = resolveRef(value, tokens).trim();
  if (!resolved || resolved.startsWith("{")) return resolved;
  return toHexColor(resolved, resolved);
}

export function normalizeHex(hex: string): string {
  const parsed = parseCssColor(hex);
  if (parsed) return rgbToHex(parsed.r, parsed.g, parsed.b);
  return hex.trim();
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number {
  const fgRgb = parseCssColor(toHexColor(fg));
  const bgRgb = parseCssColor(toHexColor(bg));
  if (!fgRgb || !bgRgb) return 1;
  const l1 = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const l2 = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightColor(color: string): boolean {
  const rgb = parseCssColor(toHexColor(color, "#808080"));
  if (!rgb) return true;
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.179;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  return parseCssColor(toHexColor(hex, ""));
}

export function lighten(hex: string, factor: number): string {
  const rgb = hexToRgb(normalizeHex(hex));
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor,
  );
}

export function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(normalizeHex(hex));
  if (!rgb) return hex;
  return rgbToHex(rgb.r * (1 - factor), rgb.g * (1 - factor), rgb.b * (1 - factor));
}

/** 12-step scale (Radix-style) from a base accent/neutral color. */
export function generateColorScale(
  baseHex: string,
  steps = 12,
  mode: PreviewMode = "light",
): string[] {
  const base = toHexColor(baseHex, "#808080");

  if (mode === "dark") {
    const anchor = "#111111";
    const colors: string[] = [];
    for (let i = 1; i <= steps; i++) {
      if (i <= 2) {
        colors.push(mixHex(anchor, base, 0.04 + (2 - i) * 0.04));
      } else if (i <= 5) {
        const amount = (i - 2) / 3;
        colors.push(mixHex(anchor, base, 0.1 + amount * 0.14));
      } else if (i <= 8) {
        const amount = (i - 5) / 3;
        colors.push(mixHex(anchor, base, 0.22 + amount * 0.2));
      } else if (i <= 10) {
        const amount = (i - 8) / 2;
        colors.push(mixHex(base, "#FFFFFF", 0.12 + amount * 0.28));
      } else {
        const amount = (i - 10) / 2;
        colors.push(mixHex(base, "#FFFFFF", 0.5 + amount * 0.38));
      }
    }
    return colors;
  }

  // Light mode scales
  const baseIsLight = isLightColor(base);
  const anchor = "#FFFFFF";
  const colors: string[] = [];

  if (baseIsLight) {
    // Pale neutrals: avoid washing steps 1–8 to white; keep mid-tones for borders.
    for (let i = 1; i <= steps; i++) {
      if (i <= 2) {
        colors.push(mixHex(anchor, base, 0.14 + (2 - i) * 0.1));
      } else if (i <= 5) {
        const amount = (i - 2) / 3;
        colors.push(mixHex(anchor, base, 0.32 + amount * 0.42));
      } else if (i <= 8) {
        const amount = (i - 5) / 3;
        colors.push(darken(base, 0.04 + amount * 0.24));
      } else if (i <= 10) {
        const amount = (i - 8) / 2;
        colors.push(darken(base, 0.3 + amount * 0.38));
      } else {
        const amount = (i - 10) / 2;
        colors.push(darken(base, 0.68 + amount * 0.28));
      }
    }
    return colors;
  }

  // Saturated accents: Radix-style — anchor on white.
  for (let i = 1; i <= steps; i++) {
    if (i <= 2) {
      colors.push(mixHex(anchor, base, 0.018 + (2 - i) * 0.015));
    } else if (i <= 5) {
      const amount = (i - 2) / 3;
      colors.push(mixHex(anchor, base, 0.05 + amount * 0.2));
    } else if (i <= 8) {
      const amount = (i - 5) / 3;
      colors.push(mixHex(anchor, base, 0.22 + amount * 0.28));
    } else if (i <= 10) {
      const amount = (i - 8) / 2;
      colors.push(darken(base, 0.05 + amount * 0.35));
    } else {
      const amount = (i - 10) / 2;
      colors.push(darken(base, 0.42 + amount * 0.48));
    }
  }
  return colors;
}

/** Pick a 1-based step from a generated scale (clamped). */
export function scaleAt(scale: string[], step: number): string {
  const idx = Math.max(0, Math.min(scale.length - 1, step - 1));
  return scale[idx] ?? scale[0] ?? "#000000";
}

export function fallbackFromColors(tokens: DesignTokens): {
  primary: string;
  secondary: string;
  foreground: string;
  surface: string;
  muted: string;
  accent: string;
  border: string;
} {
  const c = tokens.colors ?? {};
  return {
    primary: toHexColor(c.primary ?? c.tertiary ?? "#3D63DD"),
    secondary: toHexColor(c.secondary ?? c.primary ?? "#1A5F7A"),
    foreground: toHexColor(c.foreground ?? c["on-surface"] ?? "#1C1B1F"),
    surface: toHexColor(c.surface ?? c.background ?? c.neutral ?? "#FAF9F6"),
    muted: toHexColor(c.muted ?? c["surface-alt"] ?? "#E8ECF0"),
    accent: toHexColor(c.tertiary ?? c.accent ?? c.primary ?? "#F4A261"),
    border: toHexColor(c.border ?? c.muted ?? "#E0E0E0"),
  };
}

/** Convert rgb()/hex color strings in parsed DESIGN.md tokens to #RRGGBB. */
export function normalizeDesignTokenColors(tokens: DesignTokens): DesignTokens {
  const out: DesignTokens = { ...tokens };

  if (out.colors) {
    out.colors = Object.fromEntries(
      Object.entries(out.colors).map(([k, v]) => [k, v.startsWith("{") ? v : toHexColor(v, v)]),
    );
  }

  if (out.components) {
    out.components = Object.fromEntries(
      Object.entries(out.components).map(([name, comp]) => {
        const next = { ...comp };
        if (next.backgroundColor && !next.backgroundColor.startsWith("{")) {
          next.backgroundColor = toHexColor(next.backgroundColor, next.backgroundColor);
        }
        if (next.textColor && !next.textColor.startsWith("{")) {
          next.textColor = toHexColor(next.textColor, next.textColor);
        }
        return [name, next];
      }),
    );
  }

  return out;
}

/** Ensure text token contrasts with its surface (handles rgb() from Orbita). */
function ensureReadableForeground(
  foreground: string,
  background: string,
  minContrast = 4.5,
): string {
  const fgHex = toHexColor(foreground, "#1C1B1F");
  const bgHex = toHexColor(background, "#FFFFFF");
  if (contrastRatio(fgHex, bgHex) >= minContrast) return fgHex;
  return isLightColor(bgHex) ? "#1C1B1F" : "#F5F5F5";
}

function mixHex(base: string, overlay: string, amount: number): string {
  const b = hexToRgb(normalizeHex(base));
  const o = hexToRgb(normalizeHex(overlay));
  if (!b || !o) return base;
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(b.r + (o.r - b.r) * t, b.g + (o.g - b.g) * t, b.b + (o.b - b.b) * t);
}

function scaleVars(prefix: string, scale: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  scale.forEach((color, i) => {
    vars[`--ds-${prefix}-${i + 1}`] = color;
  });
  return vars;
}

/** Slug for CSS custom property names from token keys. */
function slugTokenKey(key: string): string {
  return key.replace(/_/g, "-").replace(/\s+/g, "-").toLowerCase();
}

/** All `colors.*` entries as `--ds-color-{name}`. */
export function buildColorCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  const palette = fallbackFromColors(tokens);
  for (const [key, value] of Object.entries(tokens.colors ?? {})) {
    vars[`--ds-color-${slugTokenKey(key)}`] = hexValue(value, tokens);
  }
  vars["--ds-color-primary"] =
    vars["--ds-color-primary"] ?? palette.primary;
  vars["--ds-color-secondary"] =
    vars["--ds-color-secondary"] ?? palette.secondary;
  vars["--ds-color-accent"] = vars["--ds-color-accent"] ?? palette.accent;
  vars["--ds-color-foreground"] =
    vars["--ds-color-foreground"] ?? palette.foreground;
  vars["--ds-color-surface"] = vars["--ds-color-surface"] ?? palette.surface;
  vars["--ds-color-muted"] = vars["--ds-color-muted"] ?? palette.muted;
  vars["--ds-color-border"] = vars["--ds-color-border"] ?? palette.border;
  return vars;
}

/** `components.*` entries as `--ds-{component}-bg|fg|radius`. */
export function buildComponentCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, comp] of Object.entries(tokens.components ?? {})) {
    const slug = slugTokenKey(name);
    if (comp.backgroundColor) {
      vars[`--ds-${slug}-bg`] = hexValue(comp.backgroundColor, tokens);
    }
    if (comp.textColor) {
      vars[`--ds-${slug}-fg`] = hexValue(comp.textColor, tokens);
    }
    if (comp.rounded) {
      vars[`--ds-${slug}-radius`] = resolveRadius(tokens, comp.rounded);
    }
    if (/input|textfield/i.test(name)) {
      if (comp.backgroundColor) {
        vars["--ds-input-bg"] = hexValue(comp.backgroundColor, tokens);
      }
      if (comp.rounded) {
        vars["--ds-input-radius"] = resolveRadius(tokens, comp.rounded);
      }
    }
    if (/button.*primary|primary.*button/i.test(name)) {
      if (comp.backgroundColor) {
        vars["--ds-button-primary-bg"] = hexValue(comp.backgroundColor, tokens);
      }
      if (comp.textColor) {
        vars["--ds-button-primary-fg"] = hexValue(comp.textColor, tokens);
      }
      if (comp.rounded) {
        vars["--ds-button-primary-radius"] = resolveRadius(tokens, comp.rounded);
      }
    }
    if (/button.*secondary|secondary.*button/i.test(name)) {
      if (comp.backgroundColor) {
        vars["--ds-button-secondary-bg"] = hexValue(comp.backgroundColor, tokens);
      }
      if (comp.textColor) {
        vars["--ds-button-secondary-fg"] = hexValue(comp.textColor, tokens);
      }
      if (comp.rounded) {
        vars["--ds-button-secondary-radius"] = resolveRadius(tokens, comp.rounded);
      }
    }
    if (/button.*ghost|ghost.*button/i.test(name)) {
      if (comp.backgroundColor) {
        vars["--ds-button-ghost-bg"] = hexValue(comp.backgroundColor, tokens);
      }
      if (comp.textColor) {
        vars["--ds-button-ghost-fg"] = hexValue(comp.textColor, tokens);
      }
      if (comp.rounded) {
        vars["--ds-button-ghost-radius"] = resolveRadius(tokens, comp.rounded);
      }
    }
  }
  return vars;
}

/** `rounded.*` as `--ds-radius-{name}`. */
export function buildRadiusCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.rounded ?? {})) {
    const resolved = value.startsWith("{")
      ? resolveRadius(tokens, value)
      : value;
    vars[`--ds-radius-${slugTokenKey(key)}`] = resolved;
  }
  return vars;
}

/** `spacing.*` as `--ds-space-{name}`. */
export function buildSpacingCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.spacing ?? {})) {
    vars[`--ds-space-${slugTokenKey(key)}`] = value.startsWith("{")
      ? resolveRef(value, tokens)
      : value;
  }
  return vars;
}

/** `elevation.*` as `--ds-shadow-{name}`. */
export function buildElevationCssVars(
  tokens: DesignTokens,
  mode: PreviewMode,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const elevation = normalizeElevationTokens(tokens.elevation ?? {});
  for (const [key, value] of Object.entries(elevation)) {
    vars[`--ds-shadow-${slugTokenKey(key)}`] = resolveElevationForPreview(
      key,
      value,
      mode,
    );
  }
  return vars;
}

/** Brand swatches for avatars and chips. */
export function buildBrandCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  brandPalette(tokens).forEach((hex, i) => {
    vars[`--ds-brand-${i + 1}`] = hex;
  });
  return vars;
}

/** Full token map for the interactive playground (merged with semantic theme vars). */
export function buildPlaygroundTokenCssVars(
  tokens: DesignTokens,
  mode: PreviewMode,
): Record<string, string> {
  return {
    ...buildColorCssVars(tokens),
    ...buildComponentCssVars(tokens),
    ...buildRadiusCssVars(tokens),
    ...buildSpacingCssVars(tokens),
    ...buildElevationCssVars(tokens, mode),
    ...buildBrandCssVars(tokens),
  };
}

export function buildPreviewTheme(tokens: DesignTokens, mode: PreviewMode): PreviewTheme {
  const palette = fallbackFromColors(tokens);
  const accent = palette.primary;
  const gray = palette.muted;
  const accentScale = generateColorScale(accent, 12, mode);
  const grayScale = generateColorScale(gray, 12, mode);
  const accentSolid = scaleAt(accentScale, 9);
  const elevationVars = buildElevationCssVars(tokens, mode);
  const elevationMd =
    elevationVars["--ds-shadow-md"] ??
    resolveElevationForPreview("md", tokens.elevation?.md, mode);
  const tokenCssVars = buildPlaygroundTokenCssVars(tokens, mode);
  const c = tokens.colors ?? {};

  if (mode === "dark") {
    const bg = "#111111";
    const card = scaleAt(grayScale, 2);
    const muted = scaleAt(grayScale, 3);
    const inputBg = scaleAt(grayScale, 4);
    const border = scaleAt(grayScale, 7);
    const fg = scaleAt(grayScale, 12);
    const mutedFg = scaleAt(grayScale, 10);
    const accentSubtle = mixHex(scaleAt(accentScale, 4), bg, 0.35);
    const accentBorder = mixHex(scaleAt(accentScale, 6), bg, 0.5);
    const playgroundBg = scaleAt(grayScale, 1);

    const cardFg = ensureReadableForeground(fg, card);
    const cardMutedFg = ensureReadableForeground(mutedFg, card, 3);

    return {
      mode,
      accent: accentSolid,
      gray,
      background: bg,
      cssVars: {
        "--ds-bg": bg,
        "--ds-fg": fg,
        "--ds-muted-fg": mutedFg,
        "--ds-card-fg": cardFg,
        "--ds-card-muted-fg": cardMutedFg,
        "--ds-border": border,
        "--ds-card": card,
        "--ds-muted": muted,
        "--ds-input-bg": inputBg,
        "--ds-accent": accentSolid,
        "--ds-accent-fg": isLightColor(accentSolid) ? palette.foreground : "#FFFFFF",
        "--ds-accent-subtle": accentSubtle,
        "--ds-accent-border": accentBorder,
        "--ds-surface": card,
        "--ds-shadow-md": elevationMd,
        "--ds-shadow-sm":
          elevationVars["--ds-shadow-sm"] ?? "0 1px 3px rgba(0,0,0,0.35)",
        "--ds-playground-bg": playgroundBg,
        ...scaleVars("accent", accentScale),
        ...scaleVars("gray", grayScale),
        ...tokenCssVars,
      },
    };
  }

  const surfaceBg = hexValue(
    c.surface ?? c.neutral ?? c.background ?? palette.surface,
    tokens,
  );
  const accentSubtle = scaleAt(accentScale, 3);
  const accentBorder = scaleAt(accentScale, 5);
  const mutedFg = scaleAt(grayScale, 11);
  const border = scaleAt(grayScale, 7);
  const card = hexValue(c.white ?? "#FFFFFF", tokens);
  const inputBg = hexValue(c["surface-alt"] ?? c.background ?? card, tokens);
  const muted = scaleAt(grayScale, 3);
  const playgroundBg = scaleAt(grayScale, 4);
  const fg = ensureReadableForeground(palette.foreground, surfaceBg);
  const cardFg = ensureReadableForeground(palette.foreground, card);
  const cardMutedFg = ensureReadableForeground(mutedFg, card, 3);

  return {
    mode,
    accent: accentSolid,
    gray,
    background: surfaceBg,
    cssVars: {
      "--ds-bg": surfaceBg,
      "--ds-fg": fg,
      "--ds-muted-fg": mutedFg,
      "--ds-card-fg": cardFg,
      "--ds-card-muted-fg": cardMutedFg,
      "--ds-border": border,
      "--ds-card": card,
      "--ds-muted": muted,
      "--ds-input-bg": inputBg,
      "--ds-accent": accentSolid,
      "--ds-accent-fg": isLightColor(accentSolid)
        ? ensureReadableForeground(palette.foreground, accentSolid)
        : "#FFFFFF",
      "--ds-accent-subtle": accentSubtle,
      "--ds-accent-border": accentBorder,
      "--ds-surface": surfaceBg,
      "--ds-shadow-md": elevationMd,
      "--ds-shadow-sm":
        elevationVars["--ds-shadow-sm"] ?? "0 1px 2px rgba(0,0,0,0.08)",
      "--ds-playground-bg": playgroundBg,
      ...scaleVars("accent", accentScale),
      ...scaleVars("gray", grayScale),
      ...tokenCssVars,
    },
  };
}

export function resolveRadius(tokens: DesignTokens, ref?: string): string {
  if (!ref) return tokens.rounded?.md ?? "12px";
  const resolved = resolveRef(ref, tokens);
  if (resolved.startsWith("{")) return tokens.rounded?.sm ?? "8px";
  return resolved;
}

export function resolveElevation(tokens: DesignTokens, ref?: string): string | undefined {
  const key = ref?.replace(/^\{elevation\.(\w+)\}$/, "$1") ?? "md";
  const fromRef = ref ? resolveRef(ref, tokens) : undefined;
  if (fromRef && !fromRef.startsWith("{")) return fromRef;
  return tokens.elevation?.[key] ?? tokens.elevation?.md;
}

const TYPOGRAPHY_ORDER = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "body-md",
  "body-sm",
  "body",
  "label-sm",
  "label",
  "caption",
  "overline",
];

const TYPOGRAPHY_SKIP = new Set(["font-sans", "font-serif", "font-mono"]);

/** Parse `fontSize: 32px, fontWeight: 700` from inline YAML objects. */
export function parseInlineTokenProps(inner: string): Record<string, string> {
  const props: Record<string, string> = {};
  const propRe = /([\w-]+):\s*([^,}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(inner)) !== null) {
    const key = m[1]!;
    let value = m[2]!.trim().replace(/^['"]|['"]$/g, "");
    if (
      (key === "fontSize" || key === "lineHeight") &&
      /^\d+(\.\d+)?$/.test(value)
    ) {
      value = `${value}px`;
    }
    props[key] = value;
  }
  return props;
}

/** Default elevation shadows (light preview). */
export const ELEVATION_PRESETS: Record<string, string> = {
  card: "0 1px 2px rgba(0,0,0,0.07), 0 4px 14px rgba(0,0,0,0.12)",
  dropdown: "0 4px 18px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
  modal: "0 20px 50px rgba(0,0,0,0.22), 0 10px 24px rgba(0,0,0,0.14)",
  sticky: "0 2px 12px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
};

/** Stronger shadows for dark canvas preview. */
export const ELEVATION_PRESETS_DARK: Record<string, string> = {
  card: "0 2px 10px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.05)",
  dropdown: "0 10px 28px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.06)",
  modal: "0 28px 60px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.07)",
  sticky: "0 4px 14px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
};

const ELEVATION_ORDER = ["card", "dropdown", "modal", "sticky"] as const;

function extractBoxShadowValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const quoted = trimmed.match(/boxShadow:\s*['"]([^'"]+)['"]/i);
  if (quoted?.[1]) return quoted[1];

  const wrapped = trimmed.match(/^\{\s*boxShadow:\s*(.+)\s*\}$/is);
  if (wrapped?.[1]) return wrapped[1].trim().replace(/^['"]|['"]$/g, "");

  if (trimmed.includes("boxShadow:")) {
    const after = trimmed
      .replace(/^\{?\s*boxShadow:\s*/i, "")
      .replace(/\}\s*$/, "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (after) return after;
  }

  if (!trimmed.startsWith("{") && /px|rgba|rgb|#/.test(trimmed)) return trimmed;
  return null;
}

function isValidBoxShadow(value: string): boolean {
  return /px/.test(value) && !value.startsWith("{") && !value.includes("boxShadow");
}

/** Normalize elevation values like `{ boxShadow: '0 1px…' }` to raw CSS. */
export function normalizeElevationTokens(
  elevation: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(elevation)) {
    const extracted = extractBoxShadowValue(raw);
    const candidate = extracted ?? raw.trim();
    const fallback =
      ELEVATION_PRESETS[key] ??
      ELEVATION_PRESETS.card ??
      "0 1px 3px rgba(0,0,0,0.1)";
    result[key] = isValidBoxShadow(candidate) ? candidate : fallback;
  }
  return result;
}

/** Resolve a single elevation token for the preview panel. */
export function resolveElevationForPreview(
  key: string,
  value: string | undefined,
  mode: PreviewMode = "light",
): string {
  const presets = mode === "dark" ? ELEVATION_PRESETS_DARK : ELEVATION_PRESETS;
  const fallback = presets[key] ?? presets.card ?? ELEVATION_PRESETS.card!;
  if (!value) return fallback;
  const normalized = normalizeElevationTokens({ [key]: value })[key];
  if (normalized && isValidBoxShadow(normalized)) return normalized;
  return fallback;
}

/** Ordered elevation keys for consistent preview layout. */
export function getElevationPreviewItems(
  elevation: Record<string, string>,
  mode: PreviewMode = "light",
): Array<{ key: string; shadow: string; level: number }> {
  const keys = [
    ...ELEVATION_ORDER.filter((k) => k in elevation),
    ...Object.keys(elevation).filter(
      (k) => !ELEVATION_ORDER.includes(k as (typeof ELEVATION_ORDER)[number]),
    ),
  ].slice(0, 4);

  return keys.map((key, level) => ({
    key,
    shadow: resolveElevationForPreview(key, elevation[key], mode),
    level,
  }));
}

/** Merge parsed typography with defaults; inherit font-sans across scale steps. */
export function mergeTypographyTokens(
  defaults: Record<string, TypographyToken>,
  parsed?: Record<string, TypographyToken>,
): Record<string, TypographyToken> {
  const merged: Record<string, TypographyToken> = { ...defaults };

  if (parsed) {
    for (const [key, token] of Object.entries(parsed)) {
      if (key === "font-sans") {
        const ff = resolveFontFamilyToken(token);
        if (ff) merged["font-sans"] = { fontFamily: ff };
        continue;
      }
      const props =
        typeof token === "object" && token !== null
          ? normalizeTypographyEntry(token as TypographyToken & Record<string, unknown>)
          : {};
      if (Object.keys(props).length > 0) {
        merged[key] = { ...merged[key], ...props };
      }
    }
  }

  const sans =
    merged["font-sans"]?.fontFamily ??
    "'Inter', system-ui, -apple-system, sans-serif";
  for (const [key, token] of Object.entries(merged)) {
    if (TYPOGRAPHY_SKIP.has(key)) continue;
    if (!token.fontFamily) {
      merged[key] = { ...token, fontFamily: sans };
    }
  }

  return merged;
}

function resolveFontFamilyToken(token: TypographyToken): string | undefined {
  if (token.fontFamily) return token.fontFamily;
  const raw = (token as Record<string, unknown>).fontFamily;
  if (typeof raw === "string") return raw;
  return undefined;
}

function normalizeTypographyEntry(
  token: TypographyToken & Record<string, unknown>,
): TypographyToken {
  const result: TypographyToken = { ...token };
  if (typeof token.fontSize === "number") {
    result.fontSize = `${token.fontSize}px`;
  }
  if (typeof token.lineHeight === "number") {
    result.lineHeight = `${token.lineHeight}px`;
  }
  if (typeof token.fontWeight === "string") {
    const w = parseInt(token.fontWeight, 10);
    if (!Number.isNaN(w)) result.fontWeight = w;
  }
  return result;
}

/** Typography scale rows for preview (excludes font family tokens). */
export function getTypographyScaleEntries(
  typography: Record<string, TypographyToken>,
): Array<[string, TypographyToken]> {
  const entries = Object.entries(typography).filter(([key, token]) => {
    if (TYPOGRAPHY_SKIP.has(key)) return false;
    return Boolean(token.fontSize || token.fontWeight || token.lineHeight);
  });

  entries.sort(([a], [b]) => {
    const ai = TYPOGRAPHY_ORDER.indexOf(a);
    const bi = TYPOGRAPHY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return entries.slice(0, 8);
}

export function typographySampleText(key: string): string {
  if (key === "h1") return "Bringing technology to life";
  if (key.startsWith("h")) return "Section heading";
  if (key.startsWith("body")) return "Body text sample for reading comfort.";
  if (key.startsWith("label")) return "Label text";
  if (key === "caption") return "Caption or helper text";
  if (key === "overline") return "OVERLINE";
  return "The quick brown fox";
}

/** Brand colors from tokens for avatars, chips, etc. */
export function brandPalette(tokens: DesignTokens): string[] {
  const palette = fallbackFromColors(tokens);
  const c = tokens.colors ?? {};
  const candidates = [
    palette.primary,
    normalizeHex(c.secondary ?? palette.secondary),
    normalizeHex(c.tertiary ?? palette.accent),
    normalizeHex(c.accent ?? palette.accent),
    normalizeHex(c["surface-alt"] ?? palette.muted),
  ];
  const seen = new Set<string>();
  return candidates.filter((hex) => {
    const n = normalizeHex(hex);
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}
