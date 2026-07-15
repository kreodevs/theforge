/**
 * @fileoverview AST-based table normalization using remark.
 * This module provides table normalization using markdown AST parsing
 * instead of regex-based approaches.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import type { Root, Table, TableRow, TableCell, Content } from "mdast";
import { parseMarkdown, stringifyMarkdown, isTable, findNodes, replaceNodes } from "./remark-adapter.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface TableNormalizationOptions {
  /** Default alignment for columns without explicit alignment */
  defaultAlign?: "left" | "center" | "right";
  /** Global minimum width for all columns */
  globalMinWidth?: number;
  /** Whether to normalize table cell content (trim whitespace, etc.) */
  normalizeContent?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract plain text from a cell's children.
 */
function extractCellText(cell: TableCell | import("mdast").Parent): string {
  return cell.children
    .map((child) => {
      if ("value" in child) return child.value as string;
      if ("children" in child) return extractCellText(child as import("mdast").Parent);
      return "";
    })
    .join("");
}

/**
 * Get alignment from table node.
 */
function getAlignment(table: Table): Array<"left" | "center" | "right"> {
  return table.children[0]?.children.map((cell) => {
    const align = (cell as unknown as Record<string, unknown>).align;
    return (align as "left" | "center" | "right") || "left";
  }) || [];
}

/**
 * Calculate column widths.
 */
function calculateColumnWidths(table: Table): number[] {
  const widths: number[] = [];

  for (const row of table.children) {
    row.children.forEach((cell, i) => {
      const text = extractCellText(cell);
      widths[i] = Math.max(widths[i] || 0, text.length);
    });
  }

  return widths;
}

/**
 * Pad a cell to a given width.
 */
function padCell(text: string, width: number, align: "left" | "center" | "right"): string {
  const diff = width - text.length;
  if (diff <= 0) return text;

  switch (align) {
    case "right":
      return " ".repeat(diff) + text;
    case "center": {
      const left = Math.floor(diff / 2);
      const right = diff - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    case "left":
    default:
      return text + " ".repeat(diff);
  }
}

// ─── Table Operations ───────────────────────────────────────────────────

/**
 * Normalize a table AST node.
 *
 * @param table - Table AST node to normalize
 * @param options - Normalization options
 * @returns Normalized table AST node
 */
export function normalizeTableNode(
  table: Table,
  options?: TableNormalizationOptions,
): Table {
  const opts: Required<TableNormalizationOptions> = {
    defaultAlign: "left",
    globalMinWidth: 0,
    normalizeContent: true,
    ...options,
  };

  // Get alignment and widths
  const alignment = getAlignment(table);
  const widths = calculateColumnWidths(table);

  // Apply global minimum width
  const minWidths = widths.map((w) => Math.max(w, opts.globalMinWidth));

  // Create new rows with normalized content
  const newRows: TableRow[] = table.children.map((row) => {
    const newCells: TableCell[] = row.children.map((cell, i) => {
      const text = extractCellText(cell);
      const normalizedText = opts.normalizeContent ? text.trim() : text;
      const align = alignment[i] || opts.defaultAlign;
      const paddedText = padCell(normalizedText, minWidths[i] || 0, align);

      // Create new cell with normalized content
      return {
        type: "tableCell" as const,
        children: [{ type: "text" as const, value: paddedText }],
      };
    });

    return {
      type: "tableRow" as const,
      children: newCells,
    };
  });

  return {
    type: "table",
    children: newRows,
  };
}

/**
 * Normalize all tables in a markdown document.
 *
 * @param text - Markdown text containing tables
 * @param options - Normalization options
 * @returns Markdown text with normalized tables
 *
 * @example
 * ```ts
 * const input = `
 * # Title
 *
 * | Name | Age |
 * |---|---|
 * | Alice | 30 |
 * | Bob | 25 |
 * `
 *
 * const normalized = normalizeAllTablesAst(input)
 * // Tables will be properly aligned
 * ```
 */
export function normalizeAllTablesAst(
  text: string,
  options?: TableNormalizationOptions,
): string {
  const ast = parseMarkdown(text);

  // Find and replace all tables
  replaceNodes(ast, isTable, (table) => normalizeTableNode(table, options));

  return stringifyMarkdown(ast);
}

/**
 * Parse a table string into structured data.
 *
 * @param tableText - Table markdown text
 * @returns Parsed table data or null if not a valid table
 */
export function parseTableAst(tableText: string): {
  headers: string[];
  alignment: Array<"left" | "center" | "right">;
  rows: string[][];
} | null {
  const ast = parseMarkdown(tableText);
  const tables = findNodes(ast, isTable);

  if (tables.length === 0) return null;

  const table = tables[0]!;
  const alignment = getAlignment(table);
  const headers = table.children[0]?.children.map(extractCellText) || [];
  const rows = table.children.slice(1).map((row) =>
    row.children.map(extractCellText),
  );

  return { headers, alignment, rows };
}

/**
 * Generate a table markdown string from structured data.
 *
 * @param data - Table data
 * @param options - Generation options
 * @returns Markdown table string
 *
 * @example
 * ```ts
 * const table = generateTableAst({
 *   headers: ["Name", "Age"],
 *   alignment: ["left", "right"],
 *   rows: [
 *     ["Alice", "30"],
 *     ["Bob", "25"],
 *   ],
 * })
 * console.log(table)
 * // | Name  | Age |
 * // |:------|----:|
 * // | Alice |  30 |
 * // | Bob   |  25 |
 * ```
 */
export function generateTableAst(
  data: {
    headers: string[];
    alignment?: Array<"left" | "center" | "right">;
    rows: string[][];
  },
  options?: { caption?: string },
): string {
  const alignment = data.alignment || data.headers.map(() => "left");

  // Calculate column widths
  const widths = data.headers.map((header, i) => {
    const rowWidths = data.rows.map((row) => (row[i] || "").length);
    return Math.max(header.length, ...rowWidths);
  });

  // Build table lines
  const lines: string[] = [];

  // Header row
  lines.push(
    "| " +
      data.headers
        .map((header, i) => padCell(header, widths[i] || 0, alignment[i] || "left"))
        .join(" | ") +
      " |",
  );

  // Separator row
  lines.push(
    "| " +
      alignment
        .map((align, i) => {
          const sep = align === "center" ? ":---:" : align === "right" ? "---:" : ":---";
          return padCell(sep, widths[i] || 0, align);
        })
        .join(" | ") +
      " |",
  );

  // Data rows
  for (const row of data.rows) {
    lines.push(
      "| " +
        row
          .map((cell, i) => padCell(cell, widths[i] || 0, alignment[i] || "left"))
          .join(" | ") +
        " |",
    );
  }

  // Add caption if provided
  if (options?.caption) {
    lines.unshift("", options.caption, "");
  }

  return lines.join("\n");
}

/**
 * Check if a markdown string contains tables.
 *
 * @param text - Markdown text to check
 * @returns True if the text contains tables
 */
export function hasTables(text: string): boolean {
  const ast = parseMarkdown(text);
  return findNodes(ast, isTable).length > 0;
}

/**
 * Count the number of tables in a markdown document.
 *
 * @param text - Markdown text
 * @returns Number of tables found
 */
export function countTables(text: string): number {
  const ast = parseMarkdown(text);
  return findNodes(ast, isTable).length;
}
