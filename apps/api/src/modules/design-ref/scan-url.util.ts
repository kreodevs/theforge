/**
 * scan-url.util — Extrae tokens de diseño reales de un sitio web.
 *
 * Descarga el HTML + hojas de estilo enlazadas y deriva una paleta semántica
 * (colores, tipografía, CSS variables) a partir de:
 * - CSS custom properties (`--primary`, `--brand`, `--background`, …)
 * - `<meta name="theme-color">`
 * - Reglas `body`/`html`/`:root` (background/color)
 * - Frecuencia y croma de los colores usados en el CSS
 * - Google Fonts y declaraciones `font-family`
 *
 * Reutiliza el guard SSRF y las constantes del módulo scraper.
 */
import * as cheerio from "cheerio";
import { assertPublicHttpUrl } from "../scraper/url-ssrf-guard.js";
import { SCRAPER_USER_AGENT, TIMEOUT_MS, MAX_BODY_KB } from "../scraper/constants.js";

export interface ScannedDesignTokens {
  url: string;
  name: string;
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    textSecondary?: string;
    border?: string;
  };
  fonts?: { primary: string; mono?: string };
  cssVariables?: Record<string, string>;
}

export type ScanUrlResult = { tokens: ScannedDesignTokens } | { error: string };

const MAX_BODY_BYTES = MAX_BODY_KB * 1024;
const MAX_STYLESHEETS = 4;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Caché de escaneos exitosos: el endpoint y el compose evitan re-descargar. */
const scanCache = new Map<string, { tokens: ScannedDesignTokens; expiresAt: number }>();

// ─── Color parsing ───────────────────────────────────────────

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Normaliza cualquier color CSS soportado a `#RRGGBB` (o null si no aplica/transparente). */
function normalizeCssColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === "transparent" || value === "inherit" || value === "currentcolor") return null;

  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const h = hexMatch[1]!;
    if (h.length === 3) return `#${h.split("").map((c) => c + c).join("").toUpperCase()}`;
    if (h.length === 4) return `#${h.slice(0, 3).split("").map((c) => c + c).join("").toUpperCase()}`;
    if (h.length === 6) return `#${h.toUpperCase()}`;
    if (h.length === 8) return `#${h.slice(0, 6).toUpperCase()}`;
    return null;
  }

  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1]!.split(/[,/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const toNum = (p: string) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
      const r = toNum(parts[0]!);
      const g = toNum(parts[1]!);
      const b = toNum(parts[2]!);
      const a = parts[3] !== undefined ? parseFloat(parts[3]!) : 1;
      if ([r, g, b].every((n) => !Number.isNaN(n)) && a > 0.05) return toHex(r, g, b);
    }
    return null;
  }

  const hslMatch = value.match(/^hsla?\(([^)]+)\)$/);
  if (hslMatch) {
    const parts = hslMatch[1]!.split(/[,/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const h = parseFloat(parts[0]!);
      const s = parseFloat(parts[1]!);
      const l = parseFloat(parts[2]!);
      const a = parts[3] !== undefined ? parseFloat(parts[3]!) : 1;
      if ([h, s, l].every((n) => !Number.isNaN(n)) && a > 0.05) {
        const [r, g, b] = hslToRgb(h, s, l);
        return toHex(r, g, b);
      }
    }
    return null;
  }

  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

/** Luminancia relativa aproximada (0–1). */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/**
 * Vividez cromática (0–1): `max-min` en RGB normalizado. A diferencia de la
 * saturación HSL, no sobrevalora pasteles claros (p. ej. `#ACACFF`), por lo que
 * sirve mejor para elegir el color de marca real entre una escala de tonos.
 */
function vividness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)) / 255;
}

// ─── Fetch helpers ───────────────────────────────────────────

async function fetchText(
  url: string,
  accept: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await assertPublicHttpUrl(url);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: accept },
      redirect: "follow",
    });
    if (!res.ok || !res.body) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) break;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Extracción ──────────────────────────────────────────────

interface ExtractedCss {
  cssText: string;
  cssVariables: Record<string, string>;
  themeColor?: string;
  fonts: { primary?: string; mono?: string };
}

function isColorVarName(name: string): boolean {
  return /(color|colour|bg|background|primary|secondary|tertiary|accent|brand|surface|text|foreground|ink|border|muted|neutral|cta|link)/i.test(
    name,
  );
}

function collectCssVariables(cssText: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const re = /--([\w-]+)\s*:\s*([^;{}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText)) !== null) {
    const name = m[1]!.toLowerCase();
    const rawValue = m[2]!.trim();
    if (!isColorVarName(name)) continue;
    const hex = normalizeCssColor(rawValue);
    if (hex && !(name in vars)) vars[name] = hex;
  }
  return vars;
}

/** Devuelve el valor de la primera declaración `prop: color` en un bloque de selector. */
function ruleColor(cssText: string, selectors: string[], prop: string): string | null {
  for (const selector of selectors) {
    const re = new RegExp(
      `(?:^|[},])\\s*${selector}\\s*\\{([^}]*)\\}`,
      "i",
    );
    const block = re.exec(cssText)?.[1];
    if (!block) continue;
    const propRe = new RegExp(`(?:^|;|{)\\s*${prop}\\s*:\\s*([^;!}]+)`, "i");
    const value = propRe.exec(block)?.[1];
    if (value) {
      const hex = normalizeCssColor(value.trim());
      if (hex) return hex;
    }
  }
  return null;
}

function parseGoogleFontFamilies(href: string): string[] {
  const families: string[] = [];
  const re = /family=([^&:]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(href)) !== null) {
    const name = decodeURIComponent(m[1]!.replace(/\+/g, " ")).split(":")[0]!.trim();
    if (name) families.push(name);
  }
  return families;
}

function firstFontFamily(cssText: string): string | undefined {
  const re = /font-family\s*:\s*([^;!}]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssText)) !== null) {
    const stack = m[1]!.trim();
    const first = stack.split(",")[0]!.trim().replace(/^["']|["']$/g, "");
    const isValid =
      first &&
      /^[A-Za-z]/.test(first) && // empieza con letra (descarta `--var`, `<value>`)
      !/[<>(){}]/.test(first) && // sin placeholders ni funciones
      !/^(inherit|initial|unset|revert|none)$/i.test(first);
    if (isValid) return first;
  }
  return undefined;
}

function extractCss($: cheerio.CheerioAPI, inlineCss: string): ExtractedCss {
  const cssVariables = collectCssVariables(inlineCss);
  const themeColor = normalizeCssColor($('meta[name="theme-color"]').attr("content") ?? "") ?? undefined;

  const monoMatch = inlineCss.match(/font-family\s*:\s*([^;!}]*mono[^;!}]*)/i);
  const monoRaw = monoMatch?.[1]?.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  const monoFont =
    monoRaw && !/^(var\(|monospace$|inherit$|initial$|unset$)/i.test(monoRaw) && !monoRaw.startsWith("--")
      ? monoRaw
      : undefined;

  return {
    cssText: inlineCss,
    cssVariables,
    themeColor: themeColor ?? undefined,
    fonts: { primary: firstFontFamily(inlineCss), mono: monoFont },
  };
}

/** Tabla de frecuencia de colores presentes en el CSS. */
function colorFrequency(cssText: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (hex: string | null) => {
    if (!hex) return;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };
  const literalRe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(cssText)) !== null) {
    add(normalizeCssColor(m[0]));
  }
  return counts;
}

type VarPredicate = (hex: string) => boolean;

// Los predicados usan `vividness` (max-min) en vez de saturación HSL: un
// pastel claro como `#F1F4FF` tiene saturación HSL ~1.0 pero es visualmente un
// neutro; su vividez (0.05) sí lo refleja correctamente.

/** Color de marca/interacción: vívido y en rango medio (ni casi-blanco ni casi-negro). */
const isBrandColor: VarPredicate = (hex) =>
  vividness(hex) >= 0.2 && luminance(hex) > 0.12 && luminance(hex) < 0.85;
/** Tinta de texto: oscura. */
const isDark: VarPredicate = (hex) => luminance(hex) < 0.5;
/** Neutro claro (fondo/superficie): baja vividez y muy luminoso. */
const isLightNeutral: VarPredicate = (hex) => vividness(hex) < 0.12 && luminance(hex) > 0.8;
/** Neutro para bordes: baja vividez, claro pero no blanco puro. */
const isBorderNeutral: VarPredicate = (hex) =>
  vividness(hex) < 0.12 && luminance(hex) > 0.6 && luminance(hex) < 0.97;
/** Neutro (fondo/superficie) sin sesgo de luminancia (soporta temas oscuros). */
const isNeutral: VarPredicate = (hex) => vividness(hex) < 0.15;

/**
 * Elige el valor de una CSS variable cuyo nombre matchee alguno de los patrones.
 * `predicate` descarta candidatos inadecuados (p. ej. un `--brand-25` casi blanco).
 * `prefer: "chroma"` elige el más cromático de los que pasan (mejor color de marca).
 */
function selectVar(
  vars: Record<string, string>,
  patterns: RegExp[],
  opts: { predicate?: VarPredicate; prefer?: "first" | "chroma" } = {},
): string | undefined {
  const { predicate, prefer = "first" } = opts;
  const matches: string[] = [];
  for (const pattern of patterns) {
    for (const [name, hex] of Object.entries(vars)) {
      if (pattern.test(name) && (!predicate || predicate(hex))) matches.push(hex);
    }
    if (matches.length > 0 && prefer === "first") return matches[0];
  }
  if (matches.length === 0) return undefined;
  if (prefer === "chroma") {
    return matches.reduce((best, hex) => (vividness(hex) > vividness(best) ? hex : best));
  }
  return matches[0];
}

function deriveTokens(
  url: URL,
  extracted: ExtractedCss,
  googleFonts: string[],
): ScannedDesignTokens {
  const { cssVariables: vars, cssText, themeColor } = extracted;
  const freq = colorFrequency(cssText);
  const byCount = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const distinctColors = [...freq.keys()];

  const saturated = distinctColors
    .filter((hex) => vividness(hex) >= 0.28 && luminance(hex) > 0.12 && luminance(hex) < 0.9)
    .sort((a, b) => (freq.get(b)! - freq.get(a)!) || vividness(b) - vividness(a));

  const neutralsLight = distinctColors
    .filter((hex) => vividness(hex) < 0.1 && luminance(hex) > 0.85)
    .sort((a, b) => freq.get(b)! - freq.get(a)!);
  const neutralsDark = distinctColors
    .filter((hex) => vividness(hex) < 0.12 && luminance(hex) < 0.3)
    .sort((a, b) => freq.get(b)! - freq.get(a)!);

  const bodyBg = ruleColor(cssText, ["body", "html", ":root"], "background-color")
    ?? ruleColor(cssText, ["body", "html", ":root"], "background");
  const bodyText = ruleColor(cssText, ["body", "html"], "color");

  const primary =
    selectVar(
      vars,
      [/^(--)?(color-)?primary(-color)?$/, /(^|[-_])brand/, /^(--)?accent$/, /(primary|cta)/],
      { predicate: isBrandColor, prefer: "chroma" },
    ) ??
    (themeColor && isBrandColor(themeColor) ? themeColor : undefined) ??
    saturated[0] ??
    byCount.find((hex) => vividness(hex) >= 0.2) ??
    "#3B82F6";

  const accent =
    selectVar(vars, [/(accent|secondary|tertiary|highlight)/], {
      predicate: isBrandColor,
      prefer: "chroma",
    }) ??
    saturated.find((hex) => hex !== primary) ??
    primary;

  // Prioriza la variable semántica sobre la regla `body`/`html`: hojas de estilo
  // de terceros (canvas, widgets) suelen imponer un background ajeno al del sitio.
  const background =
    selectVar(vars, [/^(--)?(color-)?(bg|background)(-color)?$/, /(^|[-_])bg(-|$)/, /background/], {
      predicate: isNeutral,
    }) ??
    (bodyBg && isNeutral(bodyBg) ? bodyBg : undefined) ??
    neutralsLight[0] ??
    "#FFFFFF";

  const text =
    selectVar(vars, [/text/, /foreground/, /(^|[-_])ink(-|$)/], { predicate: isDark }) ??
    (bodyText && isDark(bodyText) ? bodyText : undefined) ??
    neutralsDark[0] ??
    "#111111";

  const border =
    selectVar(vars, [/(border|divider|outline)/], { predicate: isBorderNeutral }) ??
    distinctColors
      .filter((hex) => vividness(hex) < 0.08 && luminance(hex) > 0.6 && luminance(hex) < 0.95 && hex !== background)
      .sort((a, b) => freq.get(b)! - freq.get(a)!)[0];

  const surface =
    selectVar(vars, [/(surface|card|panel|elevated)/], { predicate: isLightNeutral }) ??
    neutralsLight.find((hex) => hex !== background) ??
    background;

  const textSecondary =
    selectVar(vars, [/(muted|secondary-?text|text-?secondary|subtle|caption)/], {
      predicate: (hex) => vividness(hex) < 0.14 && luminance(hex) < 0.7,
    }) ??
    distinctColors
      .filter((hex) => vividness(hex) < 0.12 && luminance(hex) >= 0.3 && luminance(hex) <= 0.6)
      .sort((a, b) => freq.get(b)! - freq.get(a)!)[0];

  const primaryFont = googleFonts[0] ?? extracted.fonts.primary;
  const monoFont = extracted.fonts.mono ?? googleFonts.find((f) => /mono/i.test(f));

  const colors: ScannedDesignTokens["colors"] = { primary, background, text };
  if (accent && accent !== primary) colors.accent = accent;
  if (surface && surface !== background) colors.surface = surface;
  if (border) colors.border = border;
  if (textSecondary) colors.textSecondary = textSecondary;

  return {
    url: url.toString(),
    name: url.hostname.replace(/^www\./, ""),
    colors,
    fonts: primaryFont ? { primary: primaryFont, mono: monoFont } : undefined,
    cssVariables: Object.keys(vars).length > 0 ? vars : undefined,
  };
}

// ─── API pública ─────────────────────────────────────────────

/**
 * Escanea una URL y deriva tokens de diseño reales del sitio.
 * Nunca lanza: ante error de red/SSRF devuelve `{ error }`.
 */
export async function scanUrlForDesignTokens(rawUrl: string): Promise<ScanUrlResult> {
  let url: URL;
  try {
    url = await assertPublicHttpUrl(rawUrl.trim());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "URL inválida" };
  }

  const cacheKey = url.toString();
  const cached = scanCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { tokens: cached.tokens };
  }

  const html = await fetchText(url.toString(), "text/html");
  if (!html) return { error: "No se pudo descargar la página (timeout, bloqueo o contenido no HTML)." };

  const $ = cheerio.load(html);

  // CSS embebido: <style> + atributos style=
  const styleBlocks: string[] = [];
  $("style").each((_, el) => {
    styleBlocks.push($(el).text());
  });
  $("[style]").each((_, el) => {
    const s = $(el).attr("style");
    if (s) styleBlocks.push(`x{${s}}`);
  });

  // Hojas de estilo enlazadas (limitadas)
  const sheetUrls: string[] = [];
  $('link[rel~="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      sheetUrls.push(new URL(href, url).toString());
    } catch {
      /* href inválido */
    }
  });
  const externalCss = await Promise.all(
    sheetUrls.slice(0, MAX_STYLESHEETS).map((u) => fetchText(u, "text/css")),
  );

  // Google Fonts
  const googleFonts: string[] = [];
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) googleFonts.push(...parseGoogleFontFamilies(href));
  });

  const inlineCss = [...styleBlocks, ...externalCss.filter(Boolean)].join("\n");
  if (!inlineCss.trim() && !googleFonts.length) {
    return { error: "No se encontraron estilos CSS analizables en la página." };
  }

  const extracted = extractCss($, inlineCss);
  const tokens = deriveTokens(url, extracted, googleFonts);

  scanCache.set(cacheKey, { tokens, expiresAt: Date.now() + CACHE_TTL_MS });
  return { tokens };
}
