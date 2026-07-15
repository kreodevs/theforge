/**
 * @fileoverview AST-based heading repair using remark.
 * This module provides heading repair using markdown AST parsing
 * instead of regex-based approaches.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import type { Root, Content, Heading, Paragraph, Text, Parent } from "mdast";
import {
  parseMarkdown,
  stringifyMarkdown,
  isHeading,
  isParagraph,
  findNodes,
  replaceNodes,
} from "./remark-adapter.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface HeadingRepairOptions {
  /** MDD top-level section titles to normalize */
  mddTopSections?: string[];
  /** Whether to fix inline subheadings */
  fixInlineSubheadings?: boolean;
  /** Whether to fix glued heading-prose pairs */
  fixGluedHeadingProse?: boolean;
}

// ─── Default Options ────────────────────────────────────────────────────

const DEFAULT_MDD_TOP_SECTIONS = [
  "Contexto",
  "Arquitectura y Stack",
  "Modelo de Datos",
  "Contratos de API",
  "Lógica y Edge Cases",
  "Seguridad",
  "Integración y DevOps",
  "Testing",
  "UI/UX",
  "Manifest",
];

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract plain text from a node.
 */
function extractText(node: Parent): string {
  return node.children
    .map((child) => {
      if ("value" in child) return child.value as string;
      if ("children" in child) return extractText(child as Parent);
      return "";
    })
    .join("");
}

/**
 * Check if a heading is a top-level MDD section.
 */
function isMddTopSection(text: string, sections: string[]): boolean {
  const normalized = text.replace(/^\d+\.\s+/, "").trim();
  return sections.some((s) => normalized.startsWith(s));
}

/**
 * Extract the number prefix from a heading (e.g., "1. " from "1. Contexto").
 */
function extractNumberPrefix(text: string): { number: string; rest: string } | null {
  const match = text.match(/^(\d+\.\s+)(.+)$/);
  if (!match) return null;
  return { number: match[1] || "", rest: match[2] || "" };
}

/**
 * Check if text looks like a heading that was glued to content.
 */
function looksLikeGluedHeading(text: string): boolean {
  // Pattern: "## 3. Foo### 3.1 Bar" or "## 3. Foo### SQL"
  return /^#{1,6}\s+\d+\.\s+[^\n#]+?(#{1,4}\s+)/.test(text);
}

/**
 * Check if text has inline subheading glued to it.
 */
function hasInlineSubheading(text: string): boolean {
  // Pattern: "### Título Este sistema..." or "## Foo **Bar**"
  return /^#{1,6}\s+[^\n]+?(#{1,4}\s+[A-Z])/.test(text);
}

// ─── Repair Functions ───────────────────────────────────────────────────

/**
 * Fix glued subheading pairs (e.g., "## 3. Foo### 3.1 Bar").
 */
function fixGluedSubheadingPairs(ast: Root): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    if (!looksLikeGluedHeading(text)) return heading;

    // Split at the second heading marker
    const match = text.match(/^(#{1,6}\s+\d+\.\s+[^\n#]+?)(#{1,4}\s+\S+.*)$/);
    if (!match) return heading;

    const [, firstPart, secondPart] = match;
    const secondDepth = (secondPart?.match(/^(#{1,4})/)?.[1]?.length || 3) as 1 | 2 | 3 | 4;

    // Create two separate headings
    const firstHeading: Heading = {
      type: "heading",
      depth: heading.depth,
      children: [{ type: "text", value: firstPart?.trim() || "" }],
    };

    const secondHeading: Heading = {
      type: "heading",
      depth: secondDepth,
      children: [{ type: "text", value: secondPart?.trim() || "" }],
    };

    return [firstHeading, secondHeading];
  });
}

/**
 * Fix inline subheadings glued to prose (e.g., "### Título Este sistema...").
 */
function fixInlineSubheadings(ast: Root): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    if (!hasInlineSubheading(text)) return heading;

    // Try to split at the inline subheading
    const match = text.match(/^(#{1,6}\s+)(.+?)(#{1,4}\s+[A-Z][a-záéíóúñ].*)$/);
    if (!match) return heading;

    const [, prefix, titlePart, inlinePart] = match;
    const inlineDepth = (inlinePart?.match(/^(#{1,4})/)?.[1]?.length || 3) as 1 | 2 | 3 | 4;

    // Create two separate headings
    const titleHeading: Heading = {
      type: "heading",
      depth: heading.depth,
      children: [{ type: "text", value: `${prefix}${titlePart?.trim() || ""}` }],
    };

    const inlineHeading: Heading = {
      type: "heading",
      depth: inlineDepth,
      children: [{ type: "text", value: inlinePart?.trim() || "" }],
    };

    return [titleHeading, inlineHeading];
  });
}

/**
 * Normalize MDD top-level section headings to H2.
 */
function normalizeMddTopLevelSections(
  ast: Root,
  sections: string[],
): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    if (!isMddTopSection(text, sections)) return heading;

    // Extract number prefix if present
    const numPrefix = extractNumberPrefix(text);
    const cleanText = numPrefix ? numPrefix.rest : text;

    // Normalize to H2
    return {
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: numPrefix ? `${numPrefix.number}${cleanText}` : cleanText }],
    };
  });
}

/**
 * Fix heading hash spacing (e.g., "###Foo" → "### Foo").
 */
function fixHeadingHashSpacing(ast: Root): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    // Check if there's no space after hashes
    if (/^#{1,6}[^\s#]/.test(text)) {
      return {
        ...heading,
        children: [{ type: "text", value: text.replace(/^(#{1,6})([^\s#])/, "$1 $2") }],
      };
    }
    return heading;
  });
}

/**
 * Fix glued heading-prose pairs (e.g., "## Title **bold content**").
 */
function fixGluedHeadingProse(ast: Root): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    // Pattern: heading followed by bold content
    const match = text.match(/^(#{1,6}\s+[^\n*]+?)\s+(\*\*[^\n]+\*\*)$/);
    if (!match) return heading;

    const [, titlePart, boldPart] = match;

    // Create two separate nodes
    const titleHeading: Heading = {
      type: "heading",
      depth: heading.depth,
      children: [{ type: "text", value: titlePart!.trim() }],
    };

    const paragraph: Paragraph = {
      type: "paragraph",
      children: [{ type: "strong", children: [{ type: "text", value: boldPart!.trim() }] }],
    };

    return [titleHeading, paragraph];
  });
}

/**
 * Fix heading glued to code fence (e.g., "## 3. Modelo de Datos```sql").
 */
function fixHeadingGluedToCodeFence(ast: Root): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    // Pattern: heading followed by code fence
    const match = text.match(/^(#{1,6}\s+[^\n`]+?)```(sql|json|mermaid|TechnicalMetadata)\b/);
    if (!match) return heading;

    const [, titlePart, fenceLang] = match;

    // Create heading and note that a code fence follows
    const titleHeading: Heading = {
      type: "heading",
      depth: heading.depth,
      children: [{ type: "text", value: titlePart!.trim() }],
    };

    // The code fence will be handled separately
    return titleHeading;
  });
}

/**
 * Fix mermaid suffix glued to heading (e.g., "### Superadminmermaid").
 */
function fixMermaidSuffix(ast: Root): void {
  replaceNodes(ast, isHeading, (heading) => {
    const text = extractText(heading);
    // Pattern: heading ending with "mermaid" without space
    if (/^#{1,6}\s+.*[^\s(]mermaid\s*$/.test(text)) {
      return {
        ...heading,
        children: [{ type: "text", value: text.replace(/\s*mermaid\s*$/, "") }],
      };
    }
    return heading;
  });
}

/**
 * Split inline bold label runs (e.g., "**Escenario 1** **Escenario 2**").
 */
function splitInlineBoldLabelRuns(ast: Root): void {
  replaceNodes(ast, isParagraph, (paragraph) => {
    const text = extractText(paragraph);
    // Pattern: multiple bold labels on same line
    if (/(\*\*[^*\n]+\*\*)\s+(\*\*[^*\n]+\*\*)/.test(text)) {
      const parts = text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean);
      const children: Content[] = [];

      for (const part of parts) {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          children.push({
            type: "strong",
            children: [{ type: "text", value: part.replace(/\*\*/g, "") }],
          });
        } else if (part.trim()) {
          children.push({ type: "text", value: part });
        }
      }

      return { type: "paragraph", children: children as import("mdast").PhrasingContent[] };
    }
    return paragraph;
  });
}

// ─── Main Export ────────────────────────────────────────────────────────

/**
 * Repair glued headings in a markdown document using AST parsing.
 *
 * @param text - Markdown text to repair
 * @param options - Repair options
 * @returns Repaired markdown text
 *
 * @example
 * ```ts
 * const input = "## 3. Modelo de Datos### 3.1 Tablas"
 * const repaired = repairGluedHeadingsAst(input)
 * console.log(repaired)
 * // ## 3. Modelo de Datos
 * //
 * // ### 3.1 Tablas
 * ```
 */
export function repairGluedHeadingsAst(
  text: string,
  options?: HeadingRepairOptions,
): string {
  const opts: HeadingRepairOptions = {
    mddTopSections: DEFAULT_MDD_TOP_SECTIONS,
    fixInlineSubheadings: true,
    fixGluedHeadingProse: true,
    ...options,
  };

  const ast = parseMarkdown(text);

  // Apply repairs in order
  fixMermaidSuffix(ast);
  fixHeadingGluedToCodeFence(ast);
  fixGluedSubheadingPairs(ast);
  fixInlineSubheadings(ast);
  fixHeadingHashSpacing(ast);
  normalizeMddTopLevelSections(ast, opts.mddTopSections || []);

  if (opts.fixGluedHeadingProse) {
    fixGluedHeadingProse(ast);
  }

  splitInlineBoldLabelRuns(ast);

  return stringifyMarkdown(ast);
}

/**
 * Extract all headings from a markdown document.
 *
 * @param text - Markdown text
 * @returns Array of headings with depth and text
 */
export function extractAllHeadings(text: string): Array<{ depth: number; text: string }> {
  const ast = parseMarkdown(text);
  return findNodes(ast, isHeading).map((heading) => ({
    depth: heading.depth,
    text: extractText(heading),
  }));
}

/**
 * Check if a markdown document has glued headings.
 *
 * @param text - Markdown text to check
 * @returns True if glued headings are detected
 */
export function hasGluedHeadings(text: string): boolean {
  return looksLikeGluedHeading(text) || hasInlineSubheading(text);
}
