import type { ComponentSourcePort, DesignSystemResult, McpToolResult } from "@theforge/component-source";
import { unwrapMcpToolText } from "./wireframes-mcp-resolve.util.js";

/** Máximo de caracteres del Design System enviados a agentes de wireframes / bocetos. */
export const WIREFRAME_DESIGN_SYSTEM_CONTEXT_MAX = 8_000;

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
 * Obtiene contexto de design system vía Orbita MCP (format=context).
 * Degrada a undefined si la tool falla o la fuente no está activa.
 */
export async function fetchOrbitaDesignSystemContext(
  componentSource: ComponentSourcePort,
  userId: string,
): Promise<string | undefined> {
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
      const formatted = formatDesignSystemTokens(parsed);
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
    const visualRe = /color|tipograf|typography|token|button|component|espaciado|spacing|rounded|sombra|shadow|ui kit|design system/i;
    const prioritized = sections.filter((s) => visualRe.test(s));
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
