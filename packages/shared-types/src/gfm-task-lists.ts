/**
 * @fileoverview GFM task list normalizer.
 * Ensures consistent task list formatting: proper checkbox syntax,
 * consistent markers, and proper indentation.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface TaskListOptions {
  /** Checkbox style (default: "[ ]" / "[x]") */
  checkedMarker?: string;
  uncheckedMarker?: string;
  /** Whether to normalize inconsistent markers (default: true) */
  normalizeMarkers?: boolean;
  /** Whether to sort unchecked before checked (default: false) */
  sortUncheckedFirst?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Match a task list item line.
 * Captures: indent, checkbox content, text after checkbox.
 */
const TASK_LINE_RE = /^(\s*)([-*+])\s+\[([ xX✓✔✗✘])\]\s+(.*)$/;

/**
 * Check if a line is a task list item.
 */
function isTaskLine(line: string): boolean {
  return TASK_LINE_RE.test(line);
}

/**
 * Parse a task list line into structured data.
 */
function parseTaskLine(line: string): {
  indent: string;
  marker: string;
  checked: boolean;
  text: string;
} | null {
  const match = line.match(TASK_LINE_RE);
  if (!match) return null;
  return {
    indent: match[1] ?? "",
    marker: match[2] ?? "-",
    checked: /[xX✓✔]/.test(match[3] ?? ""),
    text: match[4] ?? "",
  };
}

/**
 * Format a parsed task line back to a string.
 */
function formatTaskLine(
  indent: string,
  marker: string,
  checked: boolean,
  text: string,
  checkedMarker: string,
  uncheckedMarker: string,
): string {
  const checkbox = checked ? checkedMarker : uncheckedMarker;
  return `${indent}${marker} ${checkbox} ${text}`;
}

// ─── Main Functions ─────────────────────────────────────────────────────

/**
 * Normalize task list formatting in a markdown document.
 *
 * Fixes:
 * - Inconsistent checkbox markers (X, ✓, ✔, x → normalized)
 * - Proper spacing around checkboxes
 * - Consistent list markers
 *
 * @param text - Raw markdown text
 * @param options - Normalization options
 * @returns Normalized text
 *
 * @example
 * ```ts
 * const result = normalizeTaskLists("- [X] Done\n- [ ] Todo")
 * // Returns: "- [x] Done\n- [ ] Todo"
 * ```
 */
export function normalizeTaskLists(text: string, options?: TaskListOptions): string {
  const opts: Required<TaskListOptions> = {
    checkedMarker: "[x]",
    uncheckedMarker: "[ ]",
    normalizeMarkers: true,
    sortUncheckedFirst: false,
    ...options,
  };

  const lines = text.split("\n");
  const result: string[] = [];

  // Collect consecutive task list lines for potential sorting
  let taskGroup: Array<{ line: string; parsed: ReturnType<typeof parseTaskLine> }> = [];

  function flushTaskGroup() {
    if (taskGroup.length === 0) return;

    if (opts.sortUncheckedFirst) {
      taskGroup.sort((a, b) => {
        const aChecked = a.parsed?.checked ?? false;
        const bChecked = b.parsed?.checked ?? false;
        return Number(aChecked) - Number(bChecked);
      });
    }

    for (const item of taskGroup) {
      if (item.parsed && opts.normalizeMarkers) {
        result.push(
          formatTaskLine(
            item.parsed.indent,
            item.parsed.marker,
            item.parsed.checked,
            item.parsed.text,
            opts.checkedMarker,
            opts.uncheckedMarker,
          ),
        );
      } else {
        result.push(item.line);
      }
    }
    taskGroup = [];
  }

  for (const line of lines) {
    const parsed = parseTaskLine(line);
    if (parsed) {
      taskGroup.push({ line, parsed });
    } else {
      flushTaskGroup();
      result.push(line);
    }
  }

  flushTaskGroup();
  return result.join("\n");
}

/**
 * Check if a markdown document contains task list items.
 */
export function hasTaskLists(text: string): boolean {
  return text.split("\n").some(isTaskLine);
}

/**
 * Count task list items in a document.
 */
export function countTaskItems(text: string): { total: number; checked: number; unchecked: number } {
  let total = 0;
  let checked = 0;
  let unchecked = 0;

  for (const line of text.split("\n")) {
    const parsed = parseTaskLine(line);
    if (parsed) {
      total++;
      if (parsed.checked) checked++;
      else unchecked++;
    }
  }

  return { total, checked, unchecked };
}
