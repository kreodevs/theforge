/**
 * @fileoverview Text-based repair pipeline.
 * Orchestrates pattern classification → repair dispatch → text replacement
 * for code blocks and prose segments in markdown text.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

import { classifyCodeBlock, classifyPattern } from "./pattern-classifier.js";
import { dispatchRepair, type RepairContext, type RepairResult } from "./repairers/pattern-repairers.js";
import type { Content, Code, Paragraph } from "mdast";

// ─── Types ──────────────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Skip repair for these patterns */
  skipPatterns?: string[];
  /** Only repair these patterns (if set, all others are skipped) */
  onlyPatterns?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

export interface PipelineResult {
  /** Whether any repairs were applied */
  changed: boolean;
  /** Count of nodes repaired */
  repairedCount: number;
  /** Per-pattern repair counts */
  byPattern: Record<string, number>;
}

// ─── Pipeline ───────────────────────────────────────────────────────────

/**
 * Run the repair pipeline on raw markdown text.
 * Phase 1: classify and repair code blocks.
 * Phase 2: classify and repair prose segments.
 *
 * @param rawText - Raw markdown text
 * @param options - Pipeline options
 * @returns Repaired text + stats
 */
export function runRepairPipeline(
  rawText: string,
  options?: PipelineOptions,
): { text: string; result: PipelineResult } {
  const opts: Required<PipelineOptions> = {
    skipPatterns: [],
    onlyPatterns: [],
    debug: false,
    ...options,
  };

  const result: PipelineResult = {
    changed: false,
    repairedCount: 0,
    byPattern: {},
  };

  let workingText = rawText;

  // ── Phase 1: Code block repairs ──
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(workingText)) !== null) {
    const fullMatch = match[0];
    const lang = match[1] || null;
    const body = match[2] ?? "";

    const classification = classifyCodeBlock(lang, body);

    if (opts.skipPatterns.includes(classification.pattern)) continue;
    if (opts.onlyPatterns.length > 0 && !opts.onlyPatterns.includes(classification.pattern)) continue;

    const codeNode: Code = {
      type: "code",
      lang: lang ?? undefined,
      value: body,
    };

    const ctx: RepairContext = {
      classification,
      node: codeNode,
      rawText: body,
      index: 0,
      siblings: [],
    };

    const repairResult = dispatchRepair(ctx);

    if (repairResult.changed) {
      const repairedBlock = "```" + (lang ?? "") + "\n" + repairResult.text + "\n```";
      workingText = workingText.replace(fullMatch, repairedBlock);

      result.changed = true;
      result.repairedCount++;
      result.byPattern[classification.pattern] = (result.byPattern[classification.pattern] ?? 0) + 1;

      if (opts.debug) {
        console.log(`[Pipeline] Repaired ${classification.pattern} block at offset ${match.index}`);
      }
    }
  }

  // ── Phase 2: Prose repairs (paragraph-level) ──
  // Match lines that are NOT code fences and NOT blank
  const lines = workingText.split("\n");
  const resultLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip code fences (already handled in Phase 1)
    if (/^\s*```/.test(line ?? "")) {
      resultLines.push(line ?? "");
      i++;
      continue;
    }

    // Collect consecutive non-blank, non-fence lines into a prose block
    const proseStart = i;
    while (i < lines.length && !/^\s*```/.test(lines[i] ?? "") && (lines[i]?.trim() ?? "") !== "") {
      i++;
    }
    // If no lines were collected (empty/blank line), push it as-is and advance
    if (i === proseStart) {
      resultLines.push(line ?? "");
      i++;
      continue;
    }
    const proseBlock = lines.slice(proseStart, i).join("\n");

    if (proseBlock.length < 10) {
      resultLines.push(proseBlock);
      continue;
    }

    const classification = classifyPattern(proseBlock);

    if (classification.pattern === "unknown") {
      resultLines.push(proseBlock);
      continue;
    }
    if (opts.skipPatterns.includes(classification.pattern)) {
      resultLines.push(proseBlock);
      continue;
    }
    if (opts.onlyPatterns.length > 0 && !opts.onlyPatterns.includes(classification.pattern)) {
      resultLines.push(proseBlock);
      continue;
    }
    // Skip code-like patterns in prose (handled in Phase 1)
    if (["sql", "mermaid", "dockerfile", "docker-compose", "env", "json", "yaml"].includes(classification.pattern)) {
      resultLines.push(proseBlock);
      continue;
    }

    const paraNode: Paragraph = {
      type: "paragraph",
      children: [{ type: "text", value: proseBlock }],
    };

    const ctx: RepairContext = {
      classification,
      node: paraNode,
      rawText: proseBlock,
      index: proseStart,
      siblings: [],
    };

    const repairResult = dispatchRepair(ctx);

    if (repairResult.changed) {
      resultLines.push(repairResult.text);
      result.changed = true;
      result.repairedCount++;
      result.byPattern[classification.pattern] = (result.byPattern[classification.pattern] ?? 0) + 1;

      if (opts.debug) {
        console.log(`[Pipeline] Repaired ${classification.pattern} prose at lines ${proseStart}-${i}`);
      }
    } else {
      resultLines.push(proseBlock);
    }
  }

  workingText = resultLines.join("\n");
  return { text: workingText, result };
}

// ─── Convenience Exports ────────────────────────────────────────────────

/**
 * Classify and repair a single text block.
 * Useful for testing or one-off repairs.
 */
export function classifyAndRepair(text: string): RepairResult {
  const classification = classifyPattern(text);
  const ctx: RepairContext = {
    classification,
    node: { type: "paragraph", children: [{ type: "text", value: text }] },
    rawText: text,
    index: 0,
    siblings: [],
  };
  return dispatchRepair(ctx);
}
