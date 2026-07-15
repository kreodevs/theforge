/**
 * @fileoverview Table of Contents generator for markdown documents.
 * Uses remark heading extraction and generates GFM-compatible TOC markdown.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import { parseMarkdown, extractHeadings, type RemarkOptions } from "./remark-adapter.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface TocOptions {
  /** Minimum heading depth to include (default: 2) */
  minDepth?: number;
  /** Maximum heading depth to include (default: 4) */
  maxDepth?: number;
  /** Whether to use slugified IDs for anchors (default: true) */
  useAnchors?: boolean;
  /** Custom slug function */
  slugify?: (text: string) => string;
  /** Whether to insert the TOC into the document at a <!-- toc --> marker (default: false) */
  insertAtMarker?: boolean;
  /** Title for the TOC section (default: "Table of Contents") */
  title?: string;
}

export interface TocEntry {
  depth: number;
  text: string;
  slug: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Convert heading text to a URL-safe slug.
 */
function defaultSlugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Escape markdown special characters in heading text for display.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([[\]()])/g, "\\$1");
}

// ─── Main Functions ─────────────────────────────────────────────────────

/**
 * Generate a Table of Contents from a markdown document.
 *
 * @param text - Raw markdown text
 * @param options - TOC generation options
 * @returns TOC as markdown list string
 *
 * @example
 * ```ts
 * const toc = generateToc("# Title\n\n## Section A\n\n### Sub A.1\n\n## Section B")
 * // Returns:
 * // - [Section A](#section-a)
 //   - [Sub A.1](#sub-a1)
 // - [Section B](#section-b)
 * ```
 */
export function generateToc(text: string, options?: TocOptions): string {
  const opts: Required<TocOptions> = {
    minDepth: 2,
    maxDepth: 4,
    useAnchors: true,
    slugify: defaultSlugify,
    insertAtMarker: false,
    title: "Table of Contents",
    ...options,
  };

  const ast = parseMarkdown(text);
  const headings = extractHeadings(ast);

  const entries: TocEntry[] = headings
    .filter((h) => h.depth >= opts.minDepth && h.depth <= opts.maxDepth)
    .map((h) => ({
      depth: h.depth,
      text: h.text,
      slug: opts.slugify(h.text),
    }));

  return formatTocEntries(entries, opts);
}

/**
 * Format TOC entries as a markdown unordered list.
 */
function formatTocEntries(entries: TocEntry[], opts: Required<TocOptions>): string {
  if (entries.length === 0) return "";

  const lines: string[] = [];

  for (const entry of entries) {
    const indent = "  ".repeat(entry.depth - opts.minDepth);
    const displayText = escapeMarkdown(entry.text);

    if (opts.useAnchors) {
      lines.push(`${indent}- [${displayText}](#${entry.slug})`);
    } else {
      lines.push(`${indent}- ${displayText}`);
    }
  }

  return lines.join("\n");
}

/**
 * Insert a generated TOC into a markdown document.
 * If a `<!-- toc -->` marker exists, replaces it.
 * Otherwise, inserts after the first H1 or at the beginning.
 *
 * @param text - Raw markdown text
 * @param options - TOC options
 * @returns Markdown with TOC inserted
 */
export function insertToc(text: string, options?: TocOptions): string {
  const toc = generateToc(text, options);
  if (!toc) return text;

  const tocBlock = toc + "\n\n";

  // Check for <!-- toc --> marker
  const markerRegex = /<!--\s*toc\s*-->/i;
  if (markerRegex.test(text)) {
    return text.replace(markerRegex, tocBlock);
  }

  // Insert after first H1
  const h1Regex = /^(#\s+.+\n)/m;
  const h1Match = h1Regex.exec(text);
  if (h1Match?.index != null) {
    const insertPos = h1Match.index + h1Match[0].length;
    return text.slice(0, insertPos) + "\n" + tocBlock + text.slice(insertPos);
  }

  // Insert at beginning
  return tocBlock + text;
}
