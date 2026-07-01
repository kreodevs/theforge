/**
 * Valida que el BRD generado incluya diagramas Mermaid bien cercados (§4).
 * Complementa la extracción de delimitadores — detecta salidas que el LLM
 * formatea como markdown plano o listas en lugar de fences ```mermaid.
 */

export type BrdMermaidValidationIssue =
  | "missing_mermaid_fences"
  | "unfenced_diagram_header"
  | "list_prefixed_diagram_line";

export type BrdMermaidValidationResult =
  | { ok: true; fenceCount: number }
  | { ok: false; issues: BrdMermaidValidationIssue[]; fenceCount: number; hint: string };

/** Mínimo: ecosistema + ER + al menos 2 flujos críticos. */
export const BRD_MERMAID_MIN_FENCE_COUNT = 4;

const UNFENCED_DIAGRAM_HEADER_RE =
  /^(flowchart|graph)\s+(TD|LR|BT|RL|TB)\b|^erDiagram\b|^sequenceDiagram\b|^stateDiagram(?:-v2)?\b/i;

const LIST_PREFIXED_DIAGRAM_LINE_RE =
  /^[-*•]\s+.+(?:--+>|->>|--x|-x>|==+>|\}\|\-\-|\|\|\-\-|\}o\-\-|\-\-o\{|\}o\-\-o\{)/;

/** Cuenta bloques ```mermaid en el texto. */
export function countMermaidFences(text: string): number {
  return (text.match(/```mermaid\b/gi) ?? []).length;
}

/** Líneas con declaración de diagrama fuera de cualquier fence ```. */
export function hasUnfencedDiagramHeaders(text: string): boolean {
  const lines = text.split("\n");
  let inFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && UNFENCED_DIAGRAM_HEADER_RE.test(trimmed)) return true;
  }
  return false;
}

/** Aristas/relaciones Mermaid con prefijo de lista markdown fuera de fence. */
export function hasListPrefixedDiagramLinesOutsideFences(text: string): boolean {
  const lines = text.split("\n");
  let inFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && LIST_PREFIXED_DIAGRAM_LINE_RE.test(trimmed)) return true;
  }
  return false;
}

/**
 * Valida §4 antes de persistir. No sustituye `repairUnfencedMermaidInDocument` —
 * fuerza reintento al LLM cuando la salida es claramente incorrecta.
 */
export function validateBrdMermaidOutput(content: string): BrdMermaidValidationResult {
  const fenceCount = countMermaidFences(content);
  const issues: BrdMermaidValidationIssue[] = [];

  if (fenceCount < BRD_MERMAID_MIN_FENCE_COUNT) {
    issues.push("missing_mermaid_fences");
  }
  if (hasUnfencedDiagramHeaders(content)) {
    issues.push("unfenced_diagram_header");
  }
  if (hasListPrefixedDiagramLinesOutsideFences(content)) {
    issues.push("list_prefixed_diagram_line");
  }

  if (issues.length === 0) {
    return { ok: true, fenceCount };
  }

  const hints: string[] = [];
  if (issues.includes("missing_mermaid_fences")) {
    hints.push(
      `solo ${fenceCount} bloque(s) \`\`\`mermaid (se requieren al menos ${BRD_MERMAID_MIN_FENCE_COUNT}: ecosistema, ER, 2+ flujos)`,
    );
  }
  if (issues.includes("unfenced_diagram_header")) {
    hints.push("`flowchart`/`erDiagram`/`sequenceDiagram`/`stateDiagram-v2` sueltos sin fence");
  }
  if (issues.includes("list_prefixed_diagram_line")) {
    hints.push("aristas o relaciones como listas `- A --> B` fuera del bloque Mermaid");
  }

  return {
    ok: false,
    issues,
    fenceCount,
    hint: hints.join("; "),
  };
}
