/**
 * @fileoverview Configuration presets for the markdown formatter.
 * Provides pre-built configurations for common use cases.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import type { FormatOptions } from "./format-document-markdown-ast.js";
import type { TocOptions } from "./toc-generator.js";
import type { TaskListOptions } from "./gfm-task-lists.js";

// ─── Preset Types ───────────────────────────────────────────────────────

export interface FormatterPreset {
  name: string;
  description: string;
  format: FormatOptions;
  toc: TocOptions;
  taskList: TaskListOptions;
}

// ─── Built-in Presets ───────────────────────────────────────────────────

/**
 * Minimal preset: basic formatting, no TOC, no aggressive repairs.
 * Best for: quick cleanup of well-formed markdown.
 */
export const PRESET_MINIMAL: FormatterPreset = {
  name: "minimal",
  description: "Basic formatting, no TOC, no aggressive repairs",
  format: {
    useAst: true,
    preserveFrontmatter: true,
    generateToc: false,
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
      fixInlineSubheadings: false,
      fixGluedHeadingProse: false,
    },
    fenceRepair: {
      unwrapMarkdownFences: true,
      repairUnclosedFences: false,
      preserveMermaidDiagrams: true,
    },
  },
  toc: {
    minDepth: 2,
    maxDepth: 3,
    useAnchors: true,
    insertAtMarker: false,
  },
  taskList: {
    normalizeMarkers: true,
    sortUncheckedFirst: false,
  },
};

/**
 * Standard preset: balanced formatting with repairs.
 * Best for: normalizing LLM-generated markdown.
 */
export const PRESET_STANDARD: FormatterPreset = {
  name: "standard",
  description: "Balanced formatting with repairs, suitable for LLM output",
  format: {
    useAst: true,
    preserveFrontmatter: true,
    generateToc: false,
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
  },
  toc: {
    minDepth: 2,
    maxDepth: 4,
    useAnchors: true,
    insertAtMarker: true,
  },
  taskList: {
    normalizeMarkers: true,
    sortUncheckedFirst: false,
  },
};

/**
 * Strict preset: maximum formatting with all repairs and TOC.
 * Best for: formal documents, specs, documentation.
 */
export const PRESET_STRICT: FormatterPreset = {
  name: "strict",
  description: "Maximum formatting, all repairs, auto TOC",
  format: {
    useAst: true,
    preserveFrontmatter: true,
    generateToc: true,
    tocDepth: [2, 4],
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
      globalMinWidth: 20,
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
  },
  toc: {
    minDepth: 2,
    maxDepth: 4,
    useAnchors: true,
    insertAtMarker: true,
    title: "Contents",
  },
  taskList: {
    normalizeMarkers: true,
    sortUncheckedFirst: true,
    checkedMarker: "[x]",
    uncheckedMarker: "[ ]",
  },
};

// ─── Registry ───────────────────────────────────────────────────────────

const PRESETS: Record<string, FormatterPreset> = {
  minimal: PRESET_MINIMAL,
  standard: PRESET_STANDARD,
  strict: PRESET_STRICT,
};

/**
 * Get a preset by name.
 *
 * @param name - Preset name ("minimal", "standard", "strict")
 * @returns The preset, or undefined if not found
 *
 * @example
 * ```ts
 * const preset = getPreset("standard")
 * const formatted = formatDocumentMarkdownAst(text, preset.format)
 * ```
 */
export function getPreset(name: string): FormatterPreset | undefined {
  return PRESETS[name];
}

/**
 * List all available preset names.
 */
export function listPresets(): string[] {
  return Object.keys(PRESETS);
}

/**
 * Register a custom preset.
 */
export function registerPreset(preset: FormatterPreset): void {
  PRESETS[preset.name] = preset;
}
