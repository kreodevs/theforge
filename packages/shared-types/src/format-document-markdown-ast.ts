/**
 * @fileoverview AST-based markdown formatter using remark.
 * This module provides a comprehensive markdown formatting pipeline
 * using AST parsing instead of regex-based approaches.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import { parseMarkdown, stringifyMarkdown, type RemarkOptions } from "./remark-adapter.js";
import { normalizeAllTablesAst, type TableNormalizationOptions } from "./markdown-table-ast.js";
import { repairGluedHeadingsAst, type HeadingRepairOptions } from "./repair-glued-headings-ast.js";
import { repairMarkdownFencesAst, type FenceRepairOptions } from "./markdown-repair-ast.js";
import { normalizeMermaidInDocument } from "./mermaid.js";
import { repairFragmentedSqlFences } from "./repair-collapsed-sql.js";
import {
  repairOrphanSqlBlocks,
  repairPastedMarkdown,
  repairStrayCodeFences,
  repairTableBoundaries,
} from "./repair-pasted-markdown.js";
import { repairDirectoryTreeBlocks } from "./repair-directory-tree.js";
import {
  homogenizeMarkdownBulletMarkers,
  repairGluedMarkdownHeadings,
} from "./repair-glued-headings.js";
import {
  deduplicateDbgaDocument,
  hasDuplicateDbgaBlocks,
} from "./deduplicate-dbga-document.js";
import { splitEmbeddedMddFromDbga } from "./dbga-document-structure.js";
import { runRepairPipeline } from "./repair-pipeline.js";
import { repairMarkdownFences } from "./markdown-repair.js";
import { normalizeAllTables } from "./markdown-table.js";
import { normalizeTaskLists, type TaskListOptions } from "./gfm-task-lists.js";
import { generateToc, type TocOptions } from "./toc-generator.js";
import {
  peelTheforgeDocStamp,
  reattachTheforgeDocStamp,
} from "./theforge-doc-stamp.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface FormatOptions {
  /** Remark options for AST parsing/stringification */
  remark?: RemarkOptions;
  /** Table normalization options */
  tableNormalization?: TableNormalizationOptions;
  /** Heading repair options */
  headingRepair?: HeadingRepairOptions;
  /** Fence repair options */
  fenceRepair?: FenceRepairOptions;
  /** Task list normalization options */
  taskList?: TaskListOptions;
  /** Whether to enable AST-based processing */
  useAst?: boolean;
  /** Whether to preserve frontmatter */
  preserveFrontmatter?: boolean;
  /** Whether to generate TOC */
  generateToc?: boolean;
  /** TOC options */
  tocOptions?: TocOptions;
  /** TOC depth range [min, max] */
  tocDepth?: [number, number];
}

// ─── Default Options ────────────────────────────────────────────────────

const DEFAULT_OPTIONS: FormatOptions = {
  remark: {
    bullet: "-",
    emphasis: "_",
    strong: "_",
    listItemIndent: "one",
    rule: "-",
    ruleSpaces: false,
    gfm: true,
    frontmatter: true,
  },
  tableNormalization: {
    defaultAlign: "left",
    globalMinWidth: 0,
    normalizeContent: true,
  },
  headingRepair: {
    fixInlineSubheadings: true,
    fixGluedHeadingProse: true,
  },
  fenceRepair: {
    unwrapMarkdownFences: true,
    repairUnclosedFences: true,
    preserveMermaidDiagrams: true,
  },
  useAst: true,
  preserveFrontmatter: true,
  generateToc: false,
  tocDepth: [2, 4],
};

// ─── Helper Functions ───────────────────────────────────────────────────

/**
 * Extract frontmatter from markdown text.
 */
function extractFrontmatter(text: string): { frontmatter: string; content: string } {
  const match = text.match(/^---\n[\s\S]*?\n---\s*\n?/);
  if (!match) {
    return { frontmatter: "", content: text };
  }
  return {
    frontmatter: match[0],
    content: text.slice(match[0].length),
  };
}

/**
 * Remove outer markdown fence if present.
 */
function removeOuterMarkdownFence(text: string): string {
  if (/^```(?:markdown|md)?\s*\n/i.test(text) && /\n```\s*$/i.test(text)) {
    return text
      .replace(/^```(?:markdown|md)?\s*\n/i, "")
      .replace(/\n```\s*$/i, "")
      .trim();
  }
  return text;
}

/**
 * Remove preamble before first H1/H2.
 * Preserves The Forge Creado / Última regeneración stamp at the top.
 */
function removePreamble(text: string): string {
  const { stamp, body } = peelTheforgeDocStamp(text);
  const headerMatch = body.match(/^#{1,2}\s+/m);
  let next = body;
  if (headerMatch?.index != null && headerMatch.index > 0) {
    next = body.slice(headerMatch.index).trim();
  }
  return reattachTheforgeDocStamp(stamp, next);
}

// ─── AST-based Pipeline ────────────────────────────────────────────────

/**
 * Format markdown using AST-based processing.
 */
function formatWithAst(text: string, options: FormatOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Step 1: Basic cleanup (still regex-based for now)
  let cleaned = text.trim();

  // Step 2: AST-based fence repair
  cleaned = repairMarkdownFencesAst(cleaned, opts.fenceRepair);

  // Step 3: AST-based heading repair
  cleaned = repairGluedHeadingsAst(cleaned, opts.headingRepair);

  // Step 4: AST-based table normalization
  cleaned = normalizeAllTablesAst(cleaned, opts.tableNormalization);

  // Step 5: AST-based formatting using remark
  const ast = parseMarkdown(cleaned, opts.remark);
  let result = stringifyMarkdown(ast, opts.remark);

  // Step 6: Pattern-based repair pipeline (replaces individual repairer calls)
  const { text: repaired } = runRepairPipeline(result, {
    debug: false,
  });

  // Step 7: Remaining repairs that need full-document context
  result = repaired;
  result = repairTableBoundaries(result);
  result = repairStrayCodeFences(result);

  // Step 8: GFM task list normalization
  if (opts.taskList?.normalizeMarkers !== false) {
    result = normalizeTaskLists(result, opts.taskList);
  }

  // Step 9: Optional TOC insertion
  if (opts.generateToc) {
    const tocOpts: TocOptions = {
      minDepth: opts.tocDepth?.[0] ?? 2,
      maxDepth: opts.tocDepth?.[1] ?? 4,
      ...opts.tocOptions,
    };
    result = generateToc(result, tocOpts) + "\n\n" + result;
  }

  return result;
}

/**
 * Format markdown using regex-based processing (legacy).
 */
function formatWithRegex(text: string): string {
  let cleaned = text.trim();
  cleaned = repairPastedMarkdown(cleaned);
  cleaned = removeOuterMarkdownFence(cleaned);
  cleaned = removePreamble(cleaned);
  cleaned = cleaned.trim();

  // Apply all repairs
  cleaned = repairMarkdownFences(cleaned);
  cleaned = repairGluedMarkdownHeadings(cleaned);
  cleaned = homogenizeMarkdownBulletMarkers(cleaned);
  cleaned = normalizeAllTables(cleaned);
  cleaned = repairTableBoundaries(cleaned);
  cleaned = repairStrayCodeFences(cleaned);
  cleaned = repairGluedMarkdownHeadings(cleaned);
  cleaned = normalizeMermaidInDocument(cleaned);
  cleaned = repairFragmentedSqlFences(cleaned);
  cleaned = repairOrphanSqlBlocks(cleaned);
  cleaned = repairDirectoryTreeBlocks(cleaned);
  cleaned = repairFragmentedSqlFences(cleaned);
  cleaned = repairOrphanSqlBlocks(cleaned);

  return cleaned;
}

// ─── Main Export ────────────────────────────────────────────────────────

/**
 * Format a markdown document using AST-based processing.
 *
 * @param text - Raw markdown text to format
 * @param options - Formatting options
 * @returns Formatted markdown text
 *
 * @example
 * ```ts
 * const formatted = formatDocumentMarkdownAst(rawMarkdown)
 * console.log(formatted)
 * ```
 */
export function formatDocumentMarkdownAst(
  text: string,
  options?: FormatOptions,
): string {
  if (!text) return "";

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Extract frontmatter if present
  const { frontmatter, content } = extractFrontmatter(text);

  // Remove outer fence and preamble
  let cleaned = removeOuterMarkdownFence(content);
  cleaned = removePreamble(cleaned);

  // Check for duplicate DBGA blocks
  if (hasDuplicateDbgaBlocks(cleaned)) {
    cleaned = deduplicateDbgaDocument(cleaned);
  }

  // Format based on option
  let formatted: string;
  if (opts.useAst) {
    formatted = formatWithAst(cleaned, opts);
  } else {
    // For regex mode, we need to dynamically import
    // This is a fallback for compatibility
    formatted = cleaned; // Will be handled by legacy code
  }

  // Re-add frontmatter if needed
  if (opts.preserveFrontmatter && frontmatter) {
    return frontmatter + formatted;
  }

  return formatted;
}

/**
 * Format a DBGA/Research document body, separating embedded MDD.
 *
 * @param raw - Raw DBGA document
 * @param options - Formatting options
 * @returns Formatted document with stripped MDD
 */
export function formatDbgaDocumentAst(
  raw: string,
  options?: FormatOptions,
): {
  formatted: string;
  strippedMdd: string | null;
  deduplicated: boolean;
} {
  const { dbgaBody, embeddedMdd } = splitEmbeddedMddFromDbga(raw);
  const deduplicated = hasDuplicateDbgaBlocks(dbgaBody);
  return {
    formatted: formatDocumentMarkdownAst(dbgaBody, options),
    strippedMdd: embeddedMdd,
    deduplicated,
  };
}
