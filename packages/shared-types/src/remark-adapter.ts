/**
 * @fileoverview Remark adapter — AST-based markdown parsing and stringification.
 * This module provides a clean interface for working with markdown ASTs using remark.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import type { Root, Content, PhrasingContent, Parent } from "mdast";

// ─── Types ──────────────────────────────────────────────────────────────

export interface RemarkOptions {
  /** Bullet character for unordered lists: '-' | '*' | '+' */
  bullet?: "-" | "*" | "+";
  /** Character for emphasis: '_' | '*' */
  emphasis?: "_" | "*";
  /** Character for strong emphasis: '_' | '*' */
  strong?: "_" | "*";
  /** List item indent style: 'tab' | 'one' | 'mixed' */
  listItemIndent?: "tab" | "one" | "mixed";
  /** Horizontal rule character: '-' | '*' | '_' */
  rule?: "-" | "*" | "_";
  /** Whether to add spaces around horizontal rules */
  ruleSpaces?: boolean;
  /** Whether to enable GFM extensions (tables, task lists, strikethrough) */
  gfm?: boolean;
  /** Whether to preserve frontmatter */
  frontmatter?: boolean;
}

// ─── Default Options ────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<RemarkOptions> = {
  bullet: "-",
  emphasis: "_",
  strong: "_",
  listItemIndent: "one",
  rule: "-",
  ruleSpaces: false,
  gfm: true,
  frontmatter: true,
};

// ─── Processor Cache ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processorCache = new Map<string, any>();

function getCacheKey(options: Required<RemarkOptions>): string {
  return JSON.stringify(options);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProcessor(options: Required<RemarkOptions>): any {
  const cacheKey = getCacheKey(options);
  if (processorCache.has(cacheKey)) {
    return processorCache.get(cacheKey)!;
  }

  // Don't annotate — let TS infer each chained .use() return type
  const p = unified().use(remarkParse);

  const withGfm = options.gfm ? p.use(remarkGfm) : p;
  const withFrontmatter = options.frontmatter ? withGfm.use(remarkFrontmatter) : withGfm;
  const final = withFrontmatter.use(remarkStringify, {
    bullet: options.bullet,
    emphasis: options.emphasis,
    strong: options.strong,
    listItemIndent: options.listItemIndent,
    rule: options.rule,
    ruleSpaces: options.ruleSpaces,
  });

  processorCache.set(cacheKey, final);
  return final;
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Parse markdown text into an AST.
 *
 * @param text - Markdown text to parse
 * @param options - Remark options
 * @returns Parsed AST root node
 *
 * @example
 * ```ts
 * const ast = parseMarkdown('# Hello\n\nWorld')
 * console.log(ast.children[0]) // { type: 'heading', depth: 1, children: [...] }
 * ```
 */
export function parseMarkdown(text: string, options?: RemarkOptions): Root {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const processor = createProcessor(opts);
  return processor.parse(text) as Root;
}

/**
 * Stringify an AST back to markdown text.
 *
 * @param ast - AST root node to stringify
 * @param options - Remark options
 * @returns Stringified markdown text
 *
 * @example
 * ```ts
 * const md = stringifyMarkdown(ast)
 * console.log(md) // '# Hello\n\nWorld'
 * ```
 */
export function stringifyMarkdown(ast: Root, options?: RemarkOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const processor = createProcessor(opts);
  const file = processor.stringify(ast);
  return String(file);
}

/**
 * Parse markdown and stringify it back (normalize formatting).
 *
 * @param text - Markdown text to normalize
 * @param options - Remark options
 * @returns Normalized markdown text
 *
 * @example
 * ```ts
 * const normalized = normalizeMarkdown('# Hello   \n\nWorld')
 * console.log(normalized) // '# Hello\n\nWorld'
 * ```
 */
export function normalizeMarkdown(text: string, options?: RemarkOptions): string {
  const ast = parseMarkdown(text, options);
  return stringifyMarkdown(ast, options);
}

/**
 * Extract all heading nodes from an AST.
 *
 * @param ast - AST root node
 * @returns Array of heading nodes with their depth and text content
 */
export function extractHeadings(ast: Root): Array<{ depth: number; text: string; id?: string }> {
  const headings: Array<{ depth: number; text: string; id?: string }> = [];

  function visit(node: Content | Root) {
    if ("children" in node) {
      for (const child of node.children) {
        if (child.type === "heading") {
          const text = child.children
            .filter((c) => "value" in c || "children" in c)
            .map((c) => ("value" in c ? c.value : "children" in c ? extractText(c as Parent) : ""))
            .join("");
          headings.push({
            depth: child.depth,
            text,
            id: (child as unknown as Record<string, unknown>).id as string | undefined,
          });
        }
        visit(child);
      }
    }
  }

  visit(ast);
  return headings;
}

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
 * Find all nodes matching a predicate.
 *
 * @param ast - AST root node
 * @param predicate - Function to test each node
 * @returns Array of matching nodes
 */
export function findNodes<T extends Content>(
  ast: Root,
  predicate: (node: Content) => node is T,
): T[] {
  const results: T[] = [];

  function visit(node: Content | Root) {
    if ("children" in node) {
      for (const child of node.children) {
        if (predicate(child)) {
          results.push(child as T);
        }
        visit(child);
      }
    }
  }

  visit(ast);
  return results;
}

/**
 * Replace all nodes matching a predicate.
 *
 * @param ast - AST root node (will be mutated)
 * @param predicate - Function to test each node
 * @param replacer - Function to replace matching nodes
 */
export function replaceNodes<T extends Content>(
  ast: Root,
  predicate: (node: Content) => node is T,
  replacer: (node: T) => Content | Content[],
): void {
  function visit(parent: Content | Root) {
    if ("children" in parent) {
      const children = parent.children as Content[];
      const newChildren: Content[] = [];

      for (const child of children) {
        if (predicate(child)) {
          const replacement = replacer(child as T);
          if (Array.isArray(replacement)) {
            newChildren.push(...replacement);
          } else {
            newChildren.push(replacement);
          }
        } else {
          newChildren.push(child);
        }
        visit(child);
      }

      parent.children = newChildren as typeof parent.children;
    }
  }

  visit(ast);
}

/**
 * Check if a node is a code block (fenced or indented).
 */
export function isCodeBlock(node: Content): node is import("mdast").Code {
  return node.type === "code";
}

/**
 * Check if a node is a heading.
 */
export function isHeading(node: Content): node is import("mdast").Heading {
  return node.type === "heading";
}

/**
 * Check if a node is a paragraph.
 */
export function isParagraph(node: Content): node is import("mdast").Paragraph {
  return node.type === "paragraph";
}

/**
 * Check if a node is a list (unordered or ordered).
 */
export function isList(node: Content): node is import("mdast").List {
  return node.type === "list";
}

/**
 * Check if a node is a table.
 */
export function isTable(node: Content): node is import("mdast").Table {
  return node.type === "table";
}

/**
 * Check if a node is a blockquote.
 */
export function isBlockquote(node: Content): node is import("mdast").Blockquote {
  return node.type === "blockquote";
}

/**
 * Check if a node is a thematic break (horizontal rule).
 */
export function isThematicBreak(node: Content): node is import("mdast").ThematicBreak {
  return node.type === "thematicBreak";
}

/**
 * Check if a node is an HTML comment.
 */
export function isHtml(node: Content): node is import("mdast").Html {
  return node.type === "html";
}

/**
 * Check if a node is text.
 */
export function isText(node: Content): node is import("mdast").Text {
  return node.type === "text";
}

/**
 * Check if a node is strong (bold).
 */
export function isStrong(node: Content): node is import("mdast").Strong {
  return node.type === "strong";
}

/**
 * Check if a node is emphasis (italic).
 */
export function isEmphasis(node: Content): node is import("mdast").Emphasis {
  return node.type === "emphasis";
}
