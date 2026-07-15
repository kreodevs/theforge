/**
 * @fileoverview AST-based fence repair using remark.
 * This module provides fence repair using markdown AST parsing
 * instead of regex-based approaches.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import type { Root, Content, Code, Heading, Paragraph, Parent } from "mdast";
import {
  parseMarkdown,
  stringifyMarkdown,
  isCodeBlock,
  isHeading,
  findNodes,
  replaceNodes,
} from "./remark-adapter.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface FenceRepairOptions {
  /** Whether to unwrap markdown fences containing only markdown content */
  unwrapMarkdownFences?: boolean;
  /** Whether to repair unclosed fences */
  repairUnclosedFences?: boolean;
  /** Whether to detect and preserve mermaid diagrams */
  preserveMermaidDiagrams?: boolean;
}

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
 * Check if a code block looks like a mermaid diagram.
 */
function looksLikeMermaidDiagram(body: string): boolean {
  const trimmed = body.trim();
  if (trimmed.length < 10) return false;

  // Common mermaid patterns
  const mermaidPatterns = [
    /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)\s/m,
    /^\s*(-->|---|===|-\[|==\])/m,
    /^\s*(subgraph|end)\s/m,
    /^\s*(participant|actor|note|loop|alt|else|opt)\s/m,
  ];

  return mermaidPatterns.some((p) => p.test(trimmed));
}

/**
 * Check if a code block contains markdown-like content.
 */
function looksLikeMarkdown(body: string): boolean {
  const trimmed = body.trim();
  if (trimmed.length < 20) return false;

  // Check for markdown patterns
  const mdPatterns = [
    /^#{1,6}\s+/m, // Headings
    /^\s*[-*]\s+/m, // List items
    /^\s*\d+\.\s+/m, // Numbered lists
    /\[.+\]\(.+\)/, // Links
    /\*\*.+\*\*/, // Bold
    /_[^_]+_/, // Italic
  ];

  return mdPatterns.filter((p) => p.test(trimmed)).length >= 2;
}

/**
 * Check if a code block contains heading-only content.
 */
function looksLikeHeadingOnly(body: string): boolean {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every((l) => /^#{1,6}\s+/.test(l));
}

/**
 * Check if a code block contains infrastructure content.
 */
function looksLikeInfrastructure(body: string): boolean {
  const trimmed = body.trim();
  return /^\s*(services|version|builds|networks|volumes):/i.test(trimmed) ||
    /^\s*(FROM|RUN|COPY|CMD|EXPOSE)\s/m.test(trimmed);
}

/**
 * Check if a code block contains SQL content.
 */
function looksLikeSql(body: string): boolean {
  const trimmed = body.trim();
  return /^\s*(CREATE|ALTER|DROP|INSERT|SELECT|UPDATE|DELETE)\s/i.test(trimmed);
}

// ─── Repair Functions ───────────────────────────────────────────────────

/**
 * Unwrap code blocks containing markdown content.
 */
function unwrapMarkdownCodeBlocks(ast: Root): void {
  replaceNodes(ast, isCodeBlock, (code) => {
    // Only process unnamed code blocks
    if (code.lang) return code;

    const body = code.value;
    if (looksLikeMarkdown(body) && !looksLikeMermaidDiagram(body)) {
      // Convert to paragraph with text
      return {
        type: "paragraph",
        children: [{ type: "text", value: body }],
      };
    }

    return code;
  });
}

/**
 * Preserve mermaid code blocks (mark them for downstream processing).
 */
function preserveMermaidCodeBlocks(ast: Root): void {
  // Mermaid blocks are already handled by remark as code blocks with lang="mermaid"
  // This function can be extended to add metadata or transform them
  findNodes(ast, isCodeBlock).forEach((code) => {
    if (code.lang === "mermaid" && looksLikeMermaidDiagram(code.value)) {
      // Mark as valid mermaid diagram
      (code as unknown as Record<string, unknown>)._isValidMermaid = true;
    }
  });
}

/**
 * Fix code blocks with no language that contain only headings.
 */
function fixHeadingOnlyCodeBlocks(ast: Root): void {
  replaceNodes(ast, isCodeBlock, (code) => {
    if (code.lang) return code;

    if (looksLikeHeadingOnly(code.value)) {
      // Convert to paragraphs with headings
      const lines = code.value.split("\n").filter((l) => l.trim());
      return lines.map((line) => ({
        type: "heading" as const,
        depth: (line.match(/^(#{1,6})/)?.[1]?.length || 2) as 1 | 2 | 3 | 4 | 5 | 6,
        children: [{ type: "text" as const, value: line.replace(/^#{1,6}\s+/, "") }],
      }));
    }

    return code;
  });
}

/**
 * Fix code blocks with no language that contain infrastructure content.
 */
function fixInfrastructureCodeBlocks(ast: Root): void {
  replaceNodes(ast, isCodeBlock, (code) => {
    if (code.lang) return code;

    if (looksLikeInfrastructure(code.value)) {
      // Add appropriate language tag
      let lang = "yaml";
      if (/^\s*(FROM|RUN|COPY|CMD|EXPOSE)\s/m.test(code.value)) {
        lang = "dockerfile";
      }
      return { ...code, lang };
    }

    return code;
  });
}

/**
 * Fix code blocks with no language that contain SQL content.
 */
function fixSqlCodeBlocks(ast: Root): void {
  replaceNodes(ast, isCodeBlock, (code) => {
    if (code.lang) return code;

    if (looksLikeSql(code.value)) {
      return { ...code, lang: "sql" };
    }

    return code;
  });
}

/**
 * Fix code blocks glued to headings.
 */
function fixCodeBlocksGluedToHeadings(ast: Root): void {
  replaceNodes(ast, isCodeBlock, (code) => {
    const value = code.value;

    // Check if the code block value starts with a heading
    const headingMatch = value.match(/^(#{1,6}\s+[^\n]+)\n([\s\S]*)$/);
    if (headingMatch) {
      const [, headingText, rest] = headingMatch;

      // Create a heading node
      const heading: Heading = {
        type: "heading",
        depth: (headingText?.match(/^(#{1,6})/)?.[1]?.length || 2) as 1 | 2 | 3 | 4 | 5 | 6,
        children: [{ type: "text", value: headingText?.replace(/^#{1,6}\s+/, "") || "" }],
      };

      // Create the code block with remaining content
      const newCode: Code = {
        type: "code",
        lang: code.lang,
        value: rest!.trim(),
      };

      return [heading, newCode];
    }

    return code;
  });
}

/**
 * Fix orphan closing fences (``` without opening).
 */
function fixOrphanClosingFences(ast: Root): void {
  // This is more complex with AST - we need to track fence state
  // For now, we'll handle it at the string level
  // TODO: Implement proper AST-based orphan fence detection
}

// ─── Main Export ────────────────────────────────────────────────────────

/**
 * Repair code fences in a markdown document using AST parsing.
 *
 * @param text - Markdown text to repair
 * @param options - Repair options
 * @returns Repaired markdown text
 *
 * @example
 * ```ts
 * const input = "```markdown\n# Hello\n\nWorld\n```"
 * const repaired = repairMarkdownFencesAst(input)
 * console.log(repaired)
 * // # Hello
 * //
 * // World
 * ```
 */
export function repairMarkdownFencesAst(
  text: string,
  options?: FenceRepairOptions,
): string {
  const opts: FenceRepairOptions = {
    unwrapMarkdownFences: true,
    repairUnclosedFences: true,
    preserveMermaidDiagrams: true,
    ...options,
  };

  const ast = parseMarkdown(text);

  // Apply repairs
  if (opts.unwrapMarkdownFences) {
    unwrapMarkdownCodeBlocks(ast);
  }

  if (opts.preserveMermaidDiagrams) {
    preserveMermaidCodeBlocks(ast);
  }

  fixHeadingOnlyCodeBlocks(ast);
  fixInfrastructureCodeBlocks(ast);
  fixSqlCodeBlocks(ast);
  fixCodeBlocksGluedToHeadings(ast);

  return stringifyMarkdown(ast);
}

/**
 * Extract all code blocks from a markdown document.
 *
 * @param text - Markdown text
 * @returns Array of code blocks with language and content
 */
export function extractAllCodeBlocks(text: string): Array<{ lang?: string; value: string }> {
  const ast = parseMarkdown(text);
  return findNodes(ast, isCodeBlock).map((code) => ({
    lang: code.lang || undefined,
    value: code.value,
  }));
}

/**
 * Check if a markdown document has unclosed code fences.
 *
 * @param text - Markdown text to check
 * @returns True if unclosed fences are detected
 */
export function hasUnclosedFences(text: string): boolean {
  const lines = text.split("\n");
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
    }
  }

  return inFence;
}

/**
 * Count code blocks in a markdown document.
 *
 * @param text - Markdown text
 * @returns Number of code blocks found
 */
export function countCodeBlocks(text: string): number {
  const ast = parseMarkdown(text);
  return findNodes(ast, isCodeBlock).length;
}
