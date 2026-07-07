import type { DesignReference } from "./data/design-references.js";
import { getDesignBySlugFromCatalog } from "./data/design-catalog.js";
import { loadDesignExtractorImport } from "./data/design-extractor-import.loader.js";
import { resolveUxGuideDesignRef } from "./ux-guide-design-ref.util.js";

export type ComposeDesignSystemSource = "design-extractor-import" | "builtin-catalog";

export interface ComposeDesignSystemInput {
  projectName: string;
  storedRef: string | null | undefined;
  mddContext: string;
}

export interface ComposeDesignSystemResult {
  content: string;
  effectiveSlug: string;
  mode: "explicit" | "auto-matched";
  source: ComposeDesignSystemSource;
  referenceName: string;
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

/** Inserta o reemplaza campos en el bloque YAML inicial (si existe). */
export function upsertLeadingYamlFields(
  content: string,
  fields: Record<string, string>,
): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    const header = [
      "---",
      ...Object.entries(fields).map(([k, v]) => `${k}: ${quoteYaml(v)}`),
      "---",
    ].join("\n");
    return `${header}\n\n${content.trim()}\n`;
  }

  let yaml = match[1]!.trimEnd();
  for (const [key, value] of Object.entries(fields)) {
    const lineRe = new RegExp(`^${key}:.*$`, "m");
    const line = `${key}: ${quoteYaml(value)}`;
    yaml = lineRe.test(yaml) ? yaml.replace(lineRe, line) : `${yaml}\n${line}`;
  }
  return content.replace(match[0], `---\n${yaml}\n---`);
}

function hexOr(fallback: string, value?: string): string {
  const t = value?.trim();
  if (t && /^#[0-9A-Fa-f]{6}$/.test(t)) return t.toUpperCase();
  if (t && /^[0-9A-Fa-f]{6}$/.test(t)) return `#${t.toUpperCase()}`;
  return fallback;
}

function buildBuiltinYamlFrontMatter(ref: DesignReference, projectName: string): string {
  const c = ref.colors;
  const primary = hexOr("#6366F1", c.primary);
  const bg = hexOr("#FFFFFF", c.background);
  const surface = hexOr("#F4F4F5", c.surface ?? c.background);
  const text = hexOr("#18181B", c.text);
  const muted = hexOr("#71717A", c.textSecondary);
  const accent = hexOr(primary, c.accent ?? c.secondary);
  const border = hexOr("#E4E4E7", c.border);
  const fontSans = ref.fonts?.primary?.includes(",")
    ? ref.fonts.primary
    : `${ref.fonts?.primary ?? "Inter"}, system-ui, sans-serif`;
  const isDark = bg.toLowerCase() === "#000000" || bg.toLowerCase() === "#050505" || bg.toLowerCase() === "#0a0a0a";

  const buttonText = isDark ? "#FFFFFF" : text;
  const cardBg = surface;

  return [
    "---",
    `name: ${quoteYaml(projectName)}`,
    `description: ${quoteYaml(`${projectName} — inspirado en ${ref.name} (${ref.style})`)}`,
    "colors:",
    `  primary: ${quoteYaml(primary)}`,
    `  secondary: ${quoteYaml(accent)}`,
    `  tertiary: ${quoteYaml(muted)}`,
    `  neutral: ${quoteYaml(muted)}`,
    `  foreground: ${quoteYaml(text)}`,
    `  background: ${quoteYaml(bg)}`,
    `  muted: ${quoteYaml(muted)}`,
    `  border: ${quoteYaml(border)}`,
    `  accent: ${quoteYaml(accent)}`,
    `  danger: "#EF4444"`,
    `  success: "#22C55E"`,
    `  warning: "#F59E0B"`,
    `  info: "#3B82F6"`,
    "typography:",
    `  font-sans: [${quoteYaml(fontSans)}]`,
    "  h1: { fontSize: 32px, fontWeight: 700, lineHeight: 40px, letterSpacing: \"-0.02em\" }",
    "  h2: { fontSize: 24px, fontWeight: 600, lineHeight: 32px, letterSpacing: \"-0.01em\" }",
    "  h3: { fontSize: 20px, fontWeight: 600, lineHeight: 28px }",
    "  body-md: { fontSize: 16px, fontWeight: 400, lineHeight: 24px }",
    "  body-sm: { fontSize: 14px, fontWeight: 400, lineHeight: 20px }",
    "  label-sm: { fontSize: 12px, fontWeight: 500, lineHeight: 16px }",
    "rounded:",
    "  none: 0px",
    "  sm: 6px",
    "  md: 12px",
    "  lg: 20px",
    "  xl: 28px",
    "  full: 9999px",
    "spacing:",
    "  xxs: 2px",
    "  xs: 4px",
    "  sm: 8px",
    "  md: 16px",
    "  lg: 24px",
    "  xl: 32px",
    "  2xl: 48px",
    "  3xl: 64px",
    "elevation:",
    `  card: { boxShadow: ${quoteYaml(isDark ? "0 1px 3px rgba(255,255,255,0.08)" : "0 1px 3px rgba(0,0,0,0.08)")} }`,
    `  dropdown: { boxShadow: ${quoteYaml(isDark ? "0 8px 24px rgba(0,0,0,0.45)" : "0 8px 24px rgba(0,0,0,0.12)")} }`,
    `  modal: { boxShadow: ${quoteYaml(isDark ? "0 16px 48px rgba(0,0,0,0.55)" : "0 16px 48px rgba(0,0,0,0.18)")} }`,
    `  sticky: { boxShadow: ${quoteYaml(isDark ? "0 2px 8px rgba(0,0,0,0.35)" : "0 2px 8px rgba(0,0,0,0.06)")} }`,
    "components:",
    `  button-primary: { backgroundColor: ${quoteYaml(primary)}, textColor: ${quoteYaml(buttonText)}, rounded: md, padding: "12px 20px", typography: label-sm }`,
    `  button-secondary: { backgroundColor: transparent, textColor: ${quoteYaml(primary)}, borderColor: ${quoteYaml(border)}, rounded: md, padding: "12px 20px" }`,
    `  card: { backgroundColor: ${quoteYaml(cardBg)}, borderColor: ${quoteYaml(border)}, rounded: lg, padding: "24px" }`,
    `  input: { backgroundColor: ${quoteYaml(cardBg)}, borderColor: ${quoteYaml(border)}, textColor: ${quoteYaml(text)}, rounded: md, padding: "10px 14px" }`,
    "---",
  ].join("\n");
}

function buildOverviewMarkdown(ref: DesignReference, projectName: string, mode: string): string {
  return [
    "## Overview",
    "",
    `Design System de **${projectName}** basado en la referencia visual **${ref.name}** (${mode}).`,
    "",
    ref.description,
    "",
    "## Colors",
    "",
    "| Token | Hex |",
    "| --- | --- |",
    ...Object.entries(ref.colors)
      .filter(([, v]) => v)
      .map(([k, v]) => `| ${k} | ${v} |`),
    "",
    "## Typography",
    "",
    `- Primaria: ${ref.fonts?.primary ?? "Inter"}`,
    ref.fonts?.mono ? `- Mono: ${ref.fonts.mono}` : "",
    "",
    "## Do's and Don'ts",
    "",
    "- **Do:** Mantener contraste WCAG AA (≥4.5:1) en texto y controles.",
    `- **Do:** Usar ${ref.name} como guía de personalidad (${ref.style}), adaptando nombres al dominio del producto.`,
    "- **Don't:** Sustituir la paleta por grises genéricos sin relación con la referencia.",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function composeFromBuiltinCatalog(
  ref: DesignReference,
  projectName: string,
  mode: "explicit" | "auto-matched",
): string {
  const yaml = buildBuiltinYamlFrontMatter(ref, projectName);
  const body = buildOverviewMarkdown(ref, projectName, mode);
  return `${yaml}\n\n${body}`;
}

function composeFromDesignExtractorImport(
  ref: DesignReference,
  projectName: string,
  mode: "explicit" | "auto-matched",
  importMd: string,
): string {
  let content = importMd.trim();
  content = upsertLeadingYamlFields(content, {
    name: projectName,
    description: `${projectName} — adaptado desde ${ref.name}`,
  });

  if (!content.includes("## Overview")) {
    const intro = [
      "## Overview",
      "",
      `Design System de **${projectName}** adaptado desde **${ref.name}** (modo: ${mode}).`,
      "",
      ref.description,
      "",
    ].join("\n");
    const fmEnd = content.indexOf("---", 4);
    if (fmEnd > 0) {
      const afterFm = content.slice(fmEnd + 3).replace(/^\s+/, "");
      content = `${content.slice(0, fmEnd + 3)}\n\n${intro}${afterFm}`;
    } else {
      content = `${intro}\n${content}`;
    }
  }

  return content;
}

/**
 * Compone `uxUiGuideContent` desde la biblioteca (DESIGN.md importado o catálogo builtin).
 * Devuelve `null` si no hay referencia resoluble (p. ej. auto-match sin hits).
 */
export function composeDesignSystemFromRef(
  input: ComposeDesignSystemInput,
): ComposeDesignSystemResult | null {
  const mdd = input.mddContext.trim();
  const resolved = resolveUxGuideDesignRef(input.storedRef, mdd);
  if (!resolved.effectiveSlug || !resolved.promptBlock) {
    return null;
  }

  const ref = getDesignBySlugFromCatalog(resolved.effectiveSlug);
  if (!ref) return null;

  const mode = resolved.mode === "auto-matched" ? "auto-matched" : "explicit";
  const projectName = input.projectName.trim() || "Proyecto";
  const importMd = loadDesignExtractorImport(resolved.effectiveSlug);

  const content = importMd
    ? composeFromDesignExtractorImport(ref, projectName, mode, importMd)
    : composeFromBuiltinCatalog(ref, projectName, mode);

  return {
    content: content.trim(),
    effectiveSlug: resolved.effectiveSlug,
    mode,
    source: importMd ? "design-extractor-import" : "builtin-catalog",
    referenceName: ref.name,
  };
}
