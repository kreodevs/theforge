/**
 * Pre-render sanity checks for MDD before persist.
 * - Mermaid: normalize non-breaking spaces; reject if comma between PK and FK (ERR_MERMAID_SYNTAX).
 * - §4 Contratos de API tables: no blank lines inside table; alignment row |:---| must be second row (ERR_TABLE_SYNTAX).
 */

export const ERR_MERMAID_SYNTAX = "ERR_MERMAID_SYNTAX";
export const ERR_TABLE_SYNTAX = "ERR_TABLE_SYNTAX";

/** Normalize unicode spaces to ASCII space inside Mermaid block content. Preserves valid erDiagram syntax. */
export function sanitizeMermaidBlock(content: string): string {
  if (!content || typeof content !== "string") return "";
  return content
    .replace(/\u00A0/g, " ")
    .replace(/[\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    // Auto-repair `PK, FK` / `FK, PK` (common LLM artifact) → keep PK annotation only.
    // Mermaid erDiagram attributes accept one annotation per line; the FK is expressed via relationship lines.
    .replace(/\bPK\s*,\s*FK\b/gi, "PK")
    .replace(/\bFK\s*,\s*PK\b/gi, "FK")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Validates Mermaid block content. Rejects if comma between PK and FK (invalid in erDiagram attributes).
 * Does not reject valid relation lines (e.g. Entity1 ||--o{ Entity2 : "fk_col").
 */
export function validateMermaidSyntax(content: string): { ok: boolean; error?: string } {
  if (!content || typeof content !== "string") return { ok: true };
  const trimmed = content.trim();
  // Comma between PK and FK in same line (attribute line): e.g. "uuid id PK, FK" or "PK, FK"
  if (/\bPK\s*,\s*FK\b|\bFK\s*,\s*PK\b/i.test(trimmed)) {
    return { ok: false, error: ERR_MERMAID_SYNTAX };
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
    // Found a table header row
    i++;
    if (i >= lines.length) break;
    const secondRow = lines[i]!.trim();
    const isAlignmentRow = /^\|[\s:\-]+(\|[\s:\-]+)*\|$/.test(secondRow);
    if (!isAlignmentRow) {
      // Insert alignment row based on header columns
      const headerCols = trimmedLine.split('|').filter(c => c.trim()).length;
      const alignRow = '|' + Array(headerCols).fill(':---').join('|') + '|';
      lines.splice(i, 0, alignRow);
      changed = true;
      i++; // skip the inserted alignment row
    }
    i++;
    // Scan body rows until blank line or non-table line
    while (i < lines.length) {
      const next = lines[i]!;
      const nextTrim = next.trim();
      if (nextTrim === "") {
        // Remove blank line inside table
        lines.splice(i, 1);
        changed = true;
        continue; // re-check the same index
      }
      if (!/^\|[\s\S]*\|$/.test(nextTrim)) break;
      i++;
    }
    while (i < lines.length && !lines[i]!.trim()) i++;
  }
  return changed ? lines.join('\n') : null;
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
 * Runs pre-render sanity: Mermaid blocks + §4 tables. If any check fails, returns { ok: false, code, message }.
 * Does not modify the draft; use sanitizeMermaidInDraft separately if you want to apply sanitization before save.
 * For §4 tables: auto-repairs common issues (missing alignment row, blank lines inside table) instead of rejecting.
 */
export function preRenderMddSanity(draft: string): PreRenderResult {
  const trimmed = (draft || "").trim();
  if (!trimmed) return { ok: true };

  const mermaidBlocks = trimmed.matchAll(/```mermaid\s*([\s\S]*?)```/gi);
  for (const m of mermaidBlocks) {
    const inner = m[1]?.trim() ?? "";
    const sanitized = sanitizeMermaidBlock(inner);
    const validation = validateMermaidSyntax(sanitized);
    if (!validation.ok) {
      return {
        ok: false,
        code: ERR_MERMAID_SYNTAX,
        message: "Diagrama Mermaid inválido: no se permite coma entre PK y FK en atributos. Corrija el bloque erDiagram.",
      };
    }
  }

  const section4 = getSection4Body(trimmed);
  // Auto-repair tables instead of rejecting — ensures alignment row and removes blank lines
  if (section4) {
    sanitizeApiTablesSyntax(section4);
  }

  return { ok: true };
}

/**
 * Applies sanitizeMermaidBlock to every ```mermaid block in the draft and returns the modified draft.
 * Use after preRenderMddSanity returns ok if you want to persist a normalized version.
 */
export function sanitizeMermaidInDraft(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  return draft.replace(/```mermaid\s*([\s\S]*?)```/gi, (_match, inner) => {
    const sanitized = sanitizeMermaidBlock(inner ?? "");
    return "```mermaid\n" + sanitized + "\n```";
  });
}

/**
 * Sanitizes §4 tables in the full draft: ensures alignment row and removes blank lines inside tables.
 * Returns the modified draft (or the original if no fixes needed).
 */
export function sanitizeSection4TablesInDraft(draft: string): string {
  if (!draft || typeof draft !== "string") return draft;
  const section4 = getSection4Body(draft);
  if (!section4) return draft;
  const fixed = sanitizeApiTablesSyntax(section4);
  if (!fixed) return draft;
  // Replace the old §4 body with the fixed version in the full draft
  // We need to re-find the exact match to replace in the original
  const fullSectionRegex = /##\s*4\.\s*Contratos\s+de\s+API[\s\S]*?(?=\n##\s+|$)/i;
  return draft.replace(fullSectionRegex, (match) => {
    const headingMatch = match.match(/^##\s*4\.\s*Contratos\s+de\s+API\s*/i);
    const heading = headingMatch ? headingMatch[0] : "## 4. Contratos de API\n\n";
    return heading + fixed;
  });
}
