/** Máximo de caracteres del Design System enviados a agentes de wireframes / bocetos. */
export const WIREFRAME_DESIGN_SYSTEM_CONTEXT_MAX = 8_000;

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
