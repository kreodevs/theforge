import { extractSection3Body, extractSection4Body } from "./mdd-sanitize.js";

export type Section34CrossRefGap = {
  field: string;
  jsonPath: string;
};

/** Response/meta fields that legitimately appear in §4 JSON without a §3 column. */
const NON_PERSISTENT_FIELD_RE =
  /^(access[_-]?token|refresh[_-]?token|token|jwt|bearer|message|error|errors|detail|details|code|status|success|ok|keys|meta|pagination|page|limit|offset|total|count|timestamp|created[_-]?at|updated[_-]?at)$/i;

function camelToSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
}

/** Parses CREATE TABLE blocks into table → column name sets (lowercase). */
export function parseSqlTableColumns(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]*?)\)\s*;/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const tableName = match[1]!.toLowerCase();
    const body = (match[2] ?? "").replace(/\s+/g, " ").trim();
    const cols = new Set<string>();
    for (const part of body.split(",")) {
      const trimmed = part.trim();
      if (!trimmed || /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s*\(|CHECK\s*\()/i.test(trimmed)) {
        continue;
      }
      const colMatch = trimmed.match(/^["']?(\w+)["']?\s+/);
      if (colMatch?.[1]) cols.add(colMatch[1].toLowerCase());
    }
    if (cols.size > 0) tables.set(tableName, cols);
  }
  return tables;
}

function collectJsonLeafPaths(value: unknown, prefix: string, out: Section34CrossRefGap[]): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (value.length > 0) collectJsonLeafPaths(value[0], prefix, out);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      collectJsonLeafPaths(child, path, out);
    } else {
      out.push({ field: key, jsonPath: path });
    }
  }
}

/** Extracts leaf field paths from ```json blocks in §4. */
export function extractJsonFieldPaths(section4Body: string): Section34CrossRefGap[] {
  const paths: Section34CrossRefGap[] = [];
  const re = /```json\s*([\s\S]*?)```/gi;
  let block: RegExpExecArray | null;
  while ((block = re.exec(section4Body)) !== null) {
    const raw = block[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      collectJsonLeafPaths(parsed, "", paths);
    } catch {
      // ignore invalid JSON blocks; auditor tools cover syntax
    }
  }
  return paths;
}

function fieldExistsInSchema(field: string, allColumns: Set<string>, tables: Map<string, Set<string>>): boolean {
  const normalized = field.toLowerCase();
  const snake = camelToSnake(field);
  if (allColumns.has(normalized) || allColumns.has(snake)) return true;
  for (const cols of tables.values()) {
    if (cols.has(normalized) || cols.has(snake)) return true;
  }
  return false;
}

/**
 * Detects JSON fields referenced in §4 that have no matching column in any CREATE TABLE of §3.
 */
export function detectSection34CrossRefGaps(draft: string): Section34CrossRefGap[] {
  const section3 = extractSection3Body(draft);
  const section4 = extractSection4Body(draft);
  if (!section3?.trim() || !section4?.trim()) return [];

  const sqlMatch = section3.match(/```sql\s*([\s\S]*?)```/i);
  const sql = sqlMatch?.[1]?.trim() ?? (/\bCREATE\s+TABLE\b/i.test(section3) ? section3 : "");
  if (!sql || !/\bCREATE\s+TABLE\b/i.test(sql)) return [];

  const tables = parseSqlTableColumns(sql);
  const allColumns = new Set<string>();
  for (const cols of tables.values()) {
    for (const c of cols) allColumns.add(c);
  }

  const jsonPaths = extractJsonFieldPaths(section4);
  const seen = new Set<string>();
  const gaps: Section34CrossRefGap[] = [];

  for (const { field, jsonPath } of jsonPaths) {
    if (NON_PERSISTENT_FIELD_RE.test(field) || NON_PERSISTENT_FIELD_RE.test(camelToSnake(field))) continue;
    const dedupeKey = jsonPath.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (!fieldExistsInSchema(field, allColumns, tables)) {
      gaps.push({ field, jsonPath });
    }
  }

  return gaps;
}
