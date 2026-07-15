/**
 * @fileoverview Per-pattern AST repairers.
 * Each repairer wraps existing domain-specific repair functions
 * with AST-aware context (node type, position, preceding heading).
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import type { Content } from "mdast";
import { classifyPattern, type ClassificationResult } from "../pattern-classifier.js";
import { normalizeMermaidInDocument } from "../mermaid.js";
import { repairFragmentedSqlFences } from "../repair-collapsed-sql.js";
import {
  repairOrphanSqlBlocks,
  repairStrayCodeFences,
  repairTableBoundaries,
} from "../repair-pasted-markdown.js";
import { repairDirectoryTreeBlocks } from "../repair-directory-tree.js";
import { repairMarkdownFences } from "../markdown-repair.js";
import { normalizeAllTables } from "../markdown-table.js";
import { homogenizeMarkdownBulletMarkers, repairGluedMarkdownHeadings } from "../repair-glued-headings.js";

// ─── Types ──────────────────────────────────────────────────────────────

export interface RepairContext {
  classification: ClassificationResult;
  node: Content;
  /** The raw text content of the node */
  rawText: string;
  /** The index of this node in parent's children array */
  index: number;
  /** All sibling nodes (for cross-node repairs like SQL orphans) */
  siblings: Content[];
  /** Preceding heading text (if any) */
  precedingHeading?: string;
}

export interface RepairResult {
  /** Repaired text (may be same as input if no repairs needed) */
  text: string;
  /** Whether any repairs were applied */
  changed: boolean;
}

// ─── Pattern-Specific Repairers ─────────────────────────────────────────

/**
 * Repair mermaid diagrams: normalization, arrow parties, activation order.
 * Note: normalizeMermaidInDocument wraps output in fences, but when called
 * from the pipeline on a code block body, we need unwrapped output.
 */
export function repairMermaid(ctx: RepairContext): RepairResult {
  // normalizeMermaidInDocument expects full markdown (with fences).
  // When called on a code block body, we need to add/remove fences ourselves.
  const hasFences = ctx.rawText.startsWith("```");
  const normalized = normalizeMermaidInDocument(ctx.rawText);
  if (normalized !== ctx.rawText) {
    // If input had no fences but output does, strip them (pipeline will add them)
    if (!hasFences && normalized.startsWith("```")) {
      const stripped = normalized
        .replace(/^```mermaid\n?/i, "")
        .replace(/\n?```\s*$/, "")
        .trim();
      return { text: stripped, changed: true };
    }
    return { text: normalized, changed: true };
  }
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair SQL blocks: fragmented fences, orphan blocks.
 */
export function repairSql(ctx: RepairContext): RepairResult {
  let text = ctx.rawText;
  let changed = false;

  const frag = repairFragmentedSqlFences(text);
  if (frag !== text) { text = frag; changed = true; }

  const orphan = repairOrphanSqlBlocks(text);
  if (orphan !== text) { text = orphan; changed = true; }

  return { text, changed };
}

/**
 * Repair Dockerfile blocks: nothing yet (future: FROM ordering).
 */
export function repairDockerfile(ctx: RepairContext): RepairResult {
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair Docker Compose blocks: nothing yet (future: indentation).
 */
export function repairDockerCompose(ctx: RepairContext): RepairResult {
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair .env blocks: nothing yet (future: sorting, quoting).
 */
export function repairEnv(ctx: RepairContext): RepairResult {
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair JSON blocks: nothing yet (future: formatting).
 */
export function repairJson(ctx: RepairContext): RepairResult {
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair YAML blocks: nothing yet (future: indentation).
 */
export function repairYaml(ctx: RepairContext): RepairResult {
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair directory tree blocks: formatting via existing repairer.
 */
export function repairDirectoryTree(ctx: RepairContext): RepairResult {
  const repaired = repairDirectoryTreeBlocks(ctx.rawText);
  if (repaired !== ctx.rawText) {
    return { text: repaired, changed: true };
  }
  return { text: ctx.rawText, changed: false };
}

/**
 * Repair markdown prose blocks: heading repair, fence repair, table normalization.
 */
export function repairMarkdownProse(ctx: RepairContext): RepairResult {
  let text = ctx.rawText;
  let changed = false;

  const headings = repairGluedMarkdownHeadings(text);
  if (headings !== text) { text = headings; changed = true; }

  const fences = repairMarkdownFences(text);
  if (fences !== text) { text = fences; changed = true; }

  const tables = normalizeAllTables(text);
  if (tables !== text) { text = tables; changed = true; }

  const bullets = homogenizeMarkdownBulletMarkers(text);
  if (bullets !== text) { text = bullets; changed = true; }

  return { text, changed };
}

/**
 * Repair unknown blocks: try stray fence repair only.
 */
export function repairUnknown(ctx: RepairContext): RepairResult {
  const fences = repairStrayCodeFences(ctx.rawText);
  if (fences !== ctx.rawText) {
    return { text: fences, changed: true };
  }
  return { text: ctx.rawText, changed: false };
}

// ─── Repair Dispatcher ──────────────────────────────────────────────────

type RepairerFn = (ctx: RepairContext) => RepairResult;

const REPAIRERS: Record<string, RepairerFn> = {
  mermaid: repairMermaid,
  sql: repairSql,
  dockerfile: repairDockerfile,
  "docker-compose": repairDockerCompose,
  env: repairEnv,
  json: repairJson,
  yaml: repairYaml,
  "directory-tree": repairDirectoryTree,
  markdown: repairMarkdownProse,
  unknown: repairUnknown,
};

/**
 * Dispatch to the appropriate pattern-specific repairer.
 *
 * @param ctx - Repair context with classification and node info
 * @returns Repair result
 */
export function dispatchRepair(ctx: RepairContext): RepairResult {
  const repairer = REPAIRERS[ctx.classification.pattern] ?? repairUnknown;
  return repairer(ctx);
}

/**
 * Get the repairer function for a given pattern.
 */
export function getRepairerForPattern(pattern: ContentPattern): RepairerFn {
  return REPAIRERS[pattern] ?? repairUnknown;
}

type ContentPattern = ClassificationResult["pattern"];
