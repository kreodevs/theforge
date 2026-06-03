import type { ComponentSourcePort, DesignSystemResult, McpToolResult } from "@theforge/component-source";
import { unwrapMcpToolText } from "./wireframes-mcp-resolve.util.js";

/** Máximo de caracteres del Design System enviados a agentes de wireframes / bocetos. */
export const WIREFRAME_DESIGN_SYSTEM_CONTEXT_MAX = 8_000;

/** Presupuesto DS para bocetos HTML (tokens + secciones visuales; sin narrativa UX). */
export const WIREFRAME_SKETCH_DESIGN_SYSTEM_CONTEXT_MAX = 4_000;

const VISUAL_DS_SECTION_RE =
  /color|tipograf|typography|token|button|component|espaciado|spacing|rounded|sombra|shadow|ui kit|design system/i;

const SKETCH_TOKEN_TOP_KEYS = new Set([
  "colors",
  "color",
  "typography",
  "font",
  "fonts",
  "spacing",
  "radius",
  "radii",
  "shadow",
  "shadows",
  "border",
  "borders",
]);

function trimDesignSystemContext(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 20)}\n\n… (recortado)`;
}

function parseDesignSystemPayload(text: string): DesignSystemResult | undefined {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("[MCP_ERROR]")) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as DesignSystemResult & { error?: string };
    if (parsed && typeof parsed === "object" && !parsed.error) return parsed;
  } catch {
    /* plain markdown context */
  }
  if (trimmed.startsWith("#") || trimmed.includes("---")) {
    return { designMd: trimmed } as DesignSystemResult;
  }
  return undefined;
}

function resolveDesignSystemResult(
  result: McpToolResult<DesignSystemResult>,
  text: string,
): DesignSystemResult | undefined {
  if (result._parsed && typeof result._parsed === "object") {
    return result._parsed;
  }
  return parseDesignSystemPayload(text);
}

/** Tokens MCP en JSON compacto (solo claves visuales relevantes para bocetos). */
export function formatDesignSystemTokensCompact(result: DesignSystemResult): string {
  const parts: string[] = [];

  if (result.tokens && typeof result.tokens === "object") {
    const picked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.tokens)) {
      if (SKETCH_TOKEN_TOP_KEYS.has(key.toLowerCase())) {
        picked[key] = value;
      }
    }
    const payload = Object.keys(picked).length > 0 ? picked : result.tokens;
    parts.push("### Tokens\n```json\n" + JSON.stringify(payload) + "\n```");
  }

  if (result.cssVars && Object.keys(result.cssVars).length > 0) {
    const entries = Object.entries(result.cssVars).slice(0, 24);
    const lines = entries.map(([k, v]) => `${k}:${v}`);
    parts.push("### CSS vars\n" + lines.join("; "));
  }

  if (Array.isArray(result.styleRules) && result.styleRules.length > 0) {
    parts.push(
      "### Style rules\n```json\n" + JSON.stringify(result.styleRules.slice(0, 8)) + "\n```",
    );
  }

  return parts.join("\n\n").trim();
}

/** Formatea tokens/cssVars cuando format=context no devuelve designMd. */
export function formatDesignSystemTokens(result: DesignSystemResult): string {
  const parts: string[] = [];

  if (result.tokens && Object.keys(result.tokens).length > 0) {
    parts.push(
      "### Tokens (Orbita MCP)\n```yaml\n" +
        JSON.stringify(result.tokens, null, 2) +
        "\n```",
    );
  }

  if (result.cssVars && Object.keys(result.cssVars).length > 0) {
    const lines = Object.entries(result.cssVars).map(([k, v]) => `  ${k}: ${v}`);
    parts.push("### CSS variables (Orbita MCP)\n```css\n:root {\n" + lines.join("\n") + "\n}\n```");
  }

  if (Array.isArray(result.styleRules) && result.styleRules.length > 0) {
    parts.push(
      "### Style rules (Orbita MCP)\n```json\n" +
        JSON.stringify(result.styleRules, null, 2) +
        "\n```",
    );
  }

  return parts.join("\n\n\n").trim();
}

/**
 * Obtiene contexto de design system vía MCP (format=context) cuando el perfil lo mapea.
 * Degrada a undefined si la tool falla, no está mapeada o la fuente no está activa.
 */
export async function fetchOrbitaDesignSystemContext(
  componentSource: ComponentSourcePort,
  userId: string,
): Promise<string | undefined> {
  if (!componentSource.capabilities?.designSystem?.get) {
    return undefined;
  }

  try {
    const health = await componentSource.checkHealth(userId);
    if (!health.ok) return undefined;

    const result = await componentSource.getDesignSystem(userId, {
      format: "context",
      includeMarkdown: true,
    });
    const text = unwrapMcpToolText(result);
    if (text.startsWith("[MCP_ERROR]") || text.includes("component_source_unavailable")) {
      return undefined;
    }

    const parsed = resolveDesignSystemResult(result, text);
    if (parsed?.designMd?.trim()) return parsed.designMd.trim();

    if (parsed) {
      const formatted = formatDesignSystemTokensCompact(parsed);
      if (formatted) return formatted;
    }

    const fallback = text.trim();
    if (fallback && !fallback.startsWith("{")) return fallback;
  } catch {
    /* degrade to UX guide only */
  }

  return undefined;
}

/**
 * Orbita MCP como SSOT de tokens; la guía UX/UI del proyecto complementa huecos.
 */
export function mergeDesignSystemContext(
  uxUiGuideContext: string,
  orbitaContext?: string,
): string {
  const orbita = orbitaContext?.trim() ?? "";
  const ux = uxUiGuideContext.trim();

  if (!orbita) return ux;
  if (!ux) return orbita;

  return [
    "### Design System Orbita (tokens MCP — fuente de verdad)",
    orbita,
    "",
    "### Guía UX/UI del proyecto (complemento)",
    ux,
  ].join("\n");
}

/**
 * Recorta y prioriza DESIGN.md (YAML + secciones visuales) para prompts de wireframes.
 */
export function prepareDesignSystemContextForWireframes(
  uxUiGuideMarkdown: string,
  maxChars: number = WIREFRAME_DESIGN_SYSTEM_CONTEXT_MAX,
): string {
  const trimmed = uxUiGuideMarkdown.trim();
  if (!trimmed) return "";

  const parts: string[] = [];

  const fmMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch?.[1]) {
    parts.push(
      "### Tokens (YAML frontmatter — fuente de verdad)\n```yaml\n" +
        fmMatch[1].trim() +
        "\n```",
    );
  }

  let body = trimmed;
  if (fmMatch) {
    body = trimmed.slice(fmMatch[0].length).trim();
  }

  if (body) {
    const sections = body.split(/\n(?=##\s)/);
    const prioritized = sections.filter((s) => VISUAL_DS_SECTION_RE.test(s));
    const rest = sections.filter((s) => !prioritized.includes(s));
    const orderedBody = [...prioritized, ...rest].join("\n\n");
    const used = parts.join("\n\n").length;
    const budget = Math.max(400, maxChars - used - 80);
    const slice =
      orderedBody.length > budget
        ? `${orderedBody.slice(0, budget)}\n\n… (guía UX/UI recortada)`
        : orderedBody;
    parts.push("### Guía UX/UI (extracto)\n" + slice);
  }

  const combined = parts.join("\n\n\n").trim();
  if (combined.length <= maxChars) return combined;
  return `${combined.slice(0, maxChars - 20)}\n\n… (recortado)`;
}

/**
 * Guía UX recortada para bocetos: YAML + solo secciones visuales (sin el resto del documento).
 */
export function prepareDesignSystemContextForSketches(
  uxUiGuideMarkdown: string,
  maxChars: number = WIREFRAME_SKETCH_DESIGN_SYSTEM_CONTEXT_MAX,
): string {
  const trimmed = uxUiGuideMarkdown.trim();
  if (!trimmed) return "";

  const parts: string[] = [];

  const fmMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch?.[1]) {
    parts.push(
      "### Tokens (YAML)\n```yaml\n" + fmMatch[1].trim() + "\n```",
    );
  }

  let body = trimmed;
  if (fmMatch) {
    body = trimmed.slice(fmMatch[0].length).trim();
  }

  if (body) {
    const sections = body.split(/\n(?=##\s)/);
    const visualOnly = sections.filter((s) => VISUAL_DS_SECTION_RE.test(s));
    if (visualOnly.length > 0) {
      const used = parts.join("\n\n").length;
      const budget = Math.max(400, maxChars - used - 80);
      const slice = visualOnly.join("\n\n");
      parts.push(
        "### Guía visual (extracto)\n" +
          (slice.length > budget ? `${slice.slice(0, budget)}\n\n… (recortado)` : slice),
      );
    }
  }

  return trimDesignSystemContext(parts.join("\n\n\n").trim(), maxChars);
}

function orbitaSketchContextIsSufficient(orbita: string): boolean {
  const o = orbita.trim();
  if (o.length < 40) return false;
  return (
    o.includes("---") ||
    /colors?|typography|primary|token|--color/i.test(o)
  );
}

/** Orbita SSOT cuando basta; UX solo si Orbita no alcanza. */
export function mergeDesignSystemContextForSketches(
  uxUiGuideContext: string,
  orbitaContext?: string,
): string {
  const orbita = orbitaContext?.trim() ?? "";
  const ux = uxUiGuideContext.trim();

  if (orbita && orbitaSketchContextIsSufficient(orbita)) {
    return orbita;
  }

  if (orbita && ux) {
    return trimDesignSystemContext([orbita, "", ux].join("\n\n"), WIREFRAME_SKETCH_DESIGN_SYSTEM_CONTEXT_MAX);
  }
  return ux || orbita;
}

/** UX + Orbita MCP optimizado para generación de bocetos HTML. */
export async function buildSketchDesignSystemContext(
  componentSource: ComponentSourcePort,
  userId: string,
  uxUiGuideMarkdown: string,
  componentSourceActive: boolean,
  maxChars: number = WIREFRAME_SKETCH_DESIGN_SYSTEM_CONTEXT_MAX,
): Promise<string> {
  if (componentSourceActive) {
    const orbitaContext = await fetchOrbitaDesignSystemContext(componentSource, userId);
    if (orbitaContext && orbitaSketchContextIsSufficient(orbitaContext)) {
      return trimDesignSystemContext(orbitaContext, maxChars);
    }
    const uxContext = prepareDesignSystemContextForSketches(uxUiGuideMarkdown, maxChars);
    const merged = mergeDesignSystemContextForSketches(uxContext, orbitaContext);
    return trimDesignSystemContext(merged, maxChars);
  }

  return prepareDesignSystemContextForSketches(uxUiGuideMarkdown, maxChars);
}

/** UX guide + Orbita MCP cuando la fuente de componentes está activa. */
export async function buildWireframeDesignSystemContext(
  componentSource: ComponentSourcePort,
  userId: string,
  uxUiGuideMarkdown: string,
  componentSourceActive: boolean,
  maxChars: number = WIREFRAME_DESIGN_SYSTEM_CONTEXT_MAX,
): Promise<string> {
  const uxContext = prepareDesignSystemContextForWireframes(uxUiGuideMarkdown, maxChars);

  if (!componentSourceActive) return uxContext;

  const orbitaContext = await fetchOrbitaDesignSystemContext(componentSource, userId);
  const merged = mergeDesignSystemContext(uxContext, orbitaContext);
  if (merged.length <= maxChars) return merged;
  return `${merged.slice(0, maxChars - 20)}\n\n… (recortado)`;
}

/** Bloque estándar para concatenar al prompt de cada agente. */
export function formatDesignSystemContextBlock(designSystemContext?: string): string {
  const ctx = designSystemContext?.trim();
  if (!ctx) return "";
  return [
    "",
    "## Design System del proyecto (OBLIGATORIO)",
    "No inventes colores hex, tipografías, radios ni patrones fuera de esta guía. " +
      "Los componentes UI deben alinearse con los tokens YAML y el catálogo MCP. " +
      "Si un valor no está definido, usa los tokens neutros del YAML (p. ej. `colors.neutral`, `body-md`).",
    "",
    ctx,
  ].join("\n");
}

/** Bloque DS compacto para bocetos (sin repetir instrucciones del agent prompt). */
export function formatSketchDesignSystemContextBlock(designSystemContext?: string): string {
  const ctx = designSystemContext?.trim();
  if (!ctx) return "";
  return ["", "## Design System (tokens — obligatorio)", ctx].join("\n");
}
