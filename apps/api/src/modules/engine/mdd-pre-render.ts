/**
 * Pre-render sanity checks for MDD before persist.
 * - Mermaid: normalize via expert normalizeMermaid from shared-types; auto-repair PK,F comma in erDiagram.
 * - §4 Contratos de API tables: no blank lines inside table; alignment row |:---| must be second row (ERR_TABLE_SYNTAX).
 */

import {
  ensureErDiagramHeader,
  erDiagramHasPkFkComma,
  looksLikeMermaidDiagramBody,
  normalizeMermaid,
  repairErDiagramPkFkCommas,
  splitMermaidFenceBodyAtDocumentLeak,
  validateMermaid,
} from "@theforge/shared-types/mermaid";

export const ERR_MERMAID_SYNTAX = "ERR_MERMAID_SYNTAX";
export const ERR_TABLE_SYNTAX = "ERR_TABLE_SYNTAX";

/** Normalize unicode spaces + PK/FK comma repair + expert normalizeMermaid. */
export function sanitizeMermaidBlock(content: string): string {
  if (!content || typeof content !== "string") return "";

  let cleaned = content
    .replace(/\u00A0/g, " ")
    .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  cleaned = repairErDiagramPkFkCommas(cleaned);
  cleaned = ensureErDiagramHeader(cleaned);

  try {
    const fenced = "```mermaid\n" + cleaned + "\n```";
    const result = normalizeMermaid(fenced);
    return result
      .replace(/^```mermaid\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
  } catch {
    return cleaned;
  }
}

export function validateMermaidSyntax(content: string): { ok: boolean; error?: string; message?: string } {
  if (!content || typeof content !== "string") return { ok: true };
  const trimmed = content.trim();

  if (erDiagramHasPkFkComma(trimmed)) {
    return {
      ok: false,
      error: ERR_MERMAID_SYNTAX,
      message:
        "Diagrama Mermaid inválido: no se permite coma entre PK y FK en atributos. Corrija el bloque erDiagram.",
    };
  }

  const errors = validateMermaid(trimmed);
  if (errors.length > 0) {
    const first = errors[0] ?? "sintaxis Mermaid inválida";
    const isPkFkHint = /PK.*FK|erDiagram/i.test(first);
    return {
      ok: false,
      error: ERR_MERMAID_SYNTAX,
      message: isPkFkHint
        ? "Diagrama Mermaid inválido: no se permite coma entre PK y FK en atributos. Corrija el bloque erDiagram."
        : `Diagrama Mermaid inválido: ${first}`,
    };
  }

  return { ok: true };
}

/**
 * Extracts body of §4 Contratos de API (from draft).
 */
function getSection4Body(draft: string): string | null {
  const match = draft.match(/##\s*4\.\s*Contratos\s+de\s+API[\s\S]*?(?=\n##\s+|$)/i);
  return match ? match[0].replace(/^##\s*4\.\s*Contratos\s+de\s+API\s*/i, "").trim() : null;
}

/**
 * Sanitizes markdown tables in §4: removes blank lines inside tables,
 * ensures alignment row (|:---|) is the second row.
 * Returns the modified section body, or null if no fix was needed.
 */
function sanitizeApiTablesSyntax(section4Body: string): string | null {
  const lines = section4Body.split(/\r?\n/);
  let changed = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmedLine = line.trim();
    if (!trimmedLine || !/^\|[\s\S]*\|$/.test(trimmedLine)) {
      i++;
      continue;
    }
    i++;
    if (i >= lines.length) break;
    const secondRow = lines[i]!.trim();
    const isAlignmentRow = /^\|[\s:\-]+(\|[\s:\-]+)*\|$/.test(secondRow);
    if (!isAlignmentRow) {
      const headerCols = trimmedLine.split("|").filter((c) => c.trim()).length;
      const alignRow = "|" + Array(headerCols).fill(":---").join("|") + "|";
      lines.splice(i, 0, alignRow);
      changed = true;
      i++;
    }
    i++;
    while (i < lines.length) {
      const next = lines[i]!;
      const nextTrim = next.trim();
      if (nextTrim === "") {
        lines.splice(i, 1);
        changed = true;
        continue;
      }
      if (!/^\|[\s\S]*\|$/.test(nextTrim)) break;
      i++;
    }
    while (i < lines.length && !lines[i]!.trim()) i++;
  }
  return changed ? lines.join("\n") : null;
}

/**
 * Validates markdown tables in §4: no blank lines inside a table; alignment row (|:---| or similar) must be second row.
 */
export function validateApiTablesSyntax(section4Body: string | null): { ok: boolean; error?: string } {
  if (!section4Body || section4Body.length < 10) return { ok: true };
  const lines = section4Body.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmedLine = line.trim();
    if (!trimmedLine || !/^\|[\s\S]*\|$/.test(trimmedLine)) {
      i++;
      continue;
    }
    i++;
    if (i >= lines.length) return { ok: false, error: ERR_TABLE_SYNTAX };
    const secondRow = lines[i]!.trim();
    const isAlignmentRow = /^\|[\s:\-]+(\|[\s:\-]+)*\|$/.test(secondRow);
    if (!isAlignmentRow) {
      return { ok: false, error: ERR_TABLE_SYNTAX };
    }
    i++;
    while (i < lines.length) {
      const next = lines[i]!;
      const nextTrim = next.trim();
      if (nextTrim === "") {
        return { ok: false, error: ERR_TABLE_SYNTAX };
      }
      if (!/^\|[\s\S]*\|$/.test(nextTrim)) break;
      i++;
    }
    while (i < lines.length && !lines[i]!.trim()) i++;
  }
  return { ok: true };
}

export interface PreRenderResult {
  ok: boolean;
  code?: string;
  message?: string;
}

/**
 * Runs pre-render sanity: Mermaid blocks + §4 tables. If a mermaid block can't be
 * salvaged (no valid diagram type after sanitization), converts it to regular
 * markdown prose instead of failing the job — the LLM sometimes wraps prose
 * headings inside ```mermaid fences by mistake.
 *
 * Returns `{ ok: false, code, message }` only for PK/FK comma issues in
 * erDiagram blocks (which need human correction, not auto-repair).
 */
export function preRenderMddSanity(draft: string): PreRenderResult {
  const trimmed = (draft || "").trim();
  if (!trimmed) return { ok: true };

  const erCommaBlocks = trimmed.match(/```mermaid\s*([\s\S]*?)```/gi) ?? [];
  for (const block of erCommaBlocks) {
    const inner = block.replace(/^```mermaid\s*/i, "").replace(/```$/i, "").trim();
    if (erDiagramHasPkFkComma(inner)) {
      return {
        ok: false,
        code: ERR_MERMAID_SYNTAX,
        message:
          "Diagrama Mermaid inválido: no se permite coma entre PK y FK en atributos. Corrija el bloque erDiagram.",
      };
    }
  }

  return { ok: true };
}

/** True si el cuerpo Mermaid tiene al menos una arista o es erDiagram con entidad. */
export function mermaidBlockHasUsableStructure(body: string): boolean {
  const t = (body ?? "").trim();
  if (!t) return false;
  if (/^erDiagram\b/i.test(t)) return /\b\w+\s*\{/.test(t) || /\|\|--/.test(t);
  return /-->|---|==>|-.->/.test(t);
}

/**
 * Reensambla nodos Mermaid que el LLM dejó fuera del fence como `### ID["label"]`
 * tras un cierre prematuro (típico en diagramas de componentes §2).
 */
export function repairPrematureMermaidFenceClose(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const lines = draft.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const isOrphanMermaidLine = (trimmed: string): boolean => {
    if (!trimmed) return false;
    if (/^#{1,6}\s+[A-Za-z_][\w]*\s*[\[(]/.test(trimmed)) return true;
    if (/^subgraph\s+/i.test(trimmed) || /^end\s*$/i.test(trimmed)) return true;
    if (/^[A-Za-z_][\w]*\s*(\[\[|\[\(|\[|"|'|\(\[)/.test(trimmed)) return true;
    if (/^[A-Za-z_][\w]*\s*(-->|---|==>|-.->)/.test(trimmed)) return true;
    if (/^\s*[A-Za-z_][\w]*\s*-->/.test(trimmed)) return true;
    return false;
  };

  const demoteHeadingNode = (line: string): string =>
    line.replace(/^(\s*)#{1,6}\s+([A-Za-z_][\w]*\s*[\[(].*)$/, "$1$2");

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (!/^```mermaid\b/i.test(trimmed)) {
      out.push(line);
      i++;
      continue;
    }

    out.push(line);
    i++;
    const bodyLines: string[] = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i]!.trim())) {
      bodyLines.push(lines[i]!);
      i++;
    }
    if (i < lines.length && /^```\s*$/.test(lines[i]!.trim())) {
      i++;
    }

    // Peek past blank lines: only swallow them if real orphan mermaid follows.
    let peek = i;
    while (peek < lines.length && !lines[peek]!.trim()) peek++;
    const peekTrim = peek < lines.length ? lines[peek]!.trim() : "";
    const hasOrphansAhead = peekTrim.length > 0 && isOrphanMermaidLine(peekTrim);

    const orphanLines: string[] = [];
    if (hasOrphansAhead) {
      while (i < peek) {
        orphanLines.push(lines[i]!);
        i++;
      }
      while (i < lines.length) {
        const next = lines[i]!;
        const nt = next.trim();
        if (!nt) {
          orphanLines.push(next);
          i++;
          continue;
        }
        if (/^#{1,2}\s+\d+\.\s+/.test(nt) || /^##\s+/.test(nt)) break;
        if (/^```/.test(nt)) break;
        if (!isOrphanMermaidLine(nt)) break;
        orphanLines.push(demoteHeadingNode(next));
        i++;
        if (orphanLines.filter((l) => l.trim()).length > 80) break;
      }
      while (orphanLines.length > 0 && !orphanLines[orphanLines.length - 1]!.trim()) {
        orphanLines.pop();
      }
    }

    const merged = [...bodyLines, ...orphanLines.map((l) => demoteHeadingNode(l))].join("\n");
    const { diagram, remainder } = splitMermaidFenceBodyAtDocumentLeak(merged);
    const sanitized = sanitizeMermaidBlock(diagram);
    if (looksLikeMermaidDiagramBody(sanitized) && mermaidBlockHasUsableStructure(sanitized)) {
      out.push(...sanitized.split("\n"));
      out.push("```");
      if (remainder.trim()) {
        out.push("");
        out.push(...remainder.split("\n"));
      }
      continue;
    }

    // Diagrama vacío/inválido: no reemitir fence; deja resto como prosa.
    if (sanitized.trim()) {
      out.push(...sanitized.split("\n"));
    }
    if (remainder.trim()) {
      out.push("");
      out.push(...remainder.split("\n"));
    } else if (orphanLines.length > 0) {
      out.push(...orphanLines);
    }
  }

  return out.join("\n");
}

/**
 * Auto-repair: strips ```mermaid fences from blocks that don't contain a
 * valid mermaid diagram type, converting them to regular markdown prose.
 * Called by `sanitizeMermaidInDraft` before validation so the pipeline
 * doesn't fail on LLM artifacts (e.g. `### Flujo: …` inside a mermaid fence).
 */
export function stripInvalidMermaidFences(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  return draft.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_full, inner: string) => {
    const { diagram, remainder } = splitMermaidFenceBodyAtDocumentLeak(inner ?? "");
    const sanitized = sanitizeMermaidBlock(diagram);
    if (looksLikeMermaidDiagramBody(sanitized) && mermaidBlockHasUsableStructure(sanitized)) {
      const fence = "```mermaid\n" + sanitized + "\n```";
      return remainder.trim() ? `${fence}\n\n${remainder}` : fence;
    }
    // Vacío / solo subgraph sin aristas / prosa → sin fence (el injector puede proponer uno).
    const prose = [sanitized, remainder].filter((s) => (s ?? "").trim()).join("\n\n");
    return prose || "";
  });
}

/**
 * Applies sanitizeMermaidBlock to every ```mermaid block in the draft and returns the modified draft.
 * Invalid mermaid blocks (prose without diagram type) are converted to regular markdown.
 * Also reensambla fences cerrados prematuramente con nodos `### ID[...]` fuera.
 */
export function sanitizeMermaidInDraft(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const reassembled = repairPrematureMermaidFenceClose(draft);
  return stripInvalidMermaidFences(reassembled);
}

/**
 * Sanitizes §4 tables in the full draft: ensures alignment row and removes blank lines inside tables.
 */
export function sanitizeSection4TablesInDraft(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const section4 = getSection4Body(draft);
  if (!section4) return draft;
  const fixed = sanitizeApiTablesSyntax(section4);
  if (!fixed) return draft;
  const fullSectionRegex = /##\s*4\.\s*Contratos\s+de\s+API[\s\S]*?(?=\n##\s+|$)/i;
  return draft.replace(fullSectionRegex, (match) => {
    const headingMatch = match.match(/^##\s*4\.\s*Contratos\s+de\s+API\s*/i);
    const heading = headingMatch ? headingMatch[0] : "## 4. Contratos de API\n\n";
    return heading + fixed;
  });
}
