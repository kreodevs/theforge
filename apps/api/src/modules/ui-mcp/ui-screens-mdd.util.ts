/**
 * @fileoverview Resolución del MDD y extracción de entidades para el deliverable Pantallas.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { ComplexityLevel, StageStatus } from "@theforge/database";
import {
  extractSection3Body,
  parseModeloDatosFromSection3Markdown,
} from "../ai-analysis/utils/mdd-sanitize.js";
import { pickPrimaryStage } from "../projects/stage-helpers.js";

/** Separa headings pegados (ej. `## 3. Modelo de Datos### 3.1`). */
export function normalizeGluedSection3Headings(mdd: string): string {
  return mdd
    .replace(/(Modelo\s+(?:de\s+)?[Dd]atos)\s*(#{2,6}\s*)/g, "$1\n\n$2")
    .replace(/^(#{1,2}\s*3\.\s*Modelo\s+(?:de\s+)?[Dd]atos)\s*(#{2,6})/gim, "$1\n\n$2");
}

/** Nombres de tabla a partir de SQL (`CREATE TABLE …`). */
export function parseCreateTableNames(sql: string): string[] {
  const entities: string[] = [];
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|public\.)?(\w+)(?:`|"|')?/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    const name = match[1];
    if (name && !entities.includes(name)) entities.push(name);
  }
  return entities;
}

const COL_DEF_REGEX =
  /([a-zA-Z_][a-zA-Z0-9_]*)\s+(UUID|VARCHAR|CHAR|TEXT|BOOLEAN|INT|BIGINT|SMALLINT|SERIAL|TIMESTAMPTZ|TIMESTAMP|DATE|TIME|NUMERIC|DECIMAL|REAL|FLOAT|DOUBLE)(\s*\([^)]+\))?/gi;

function findMatchingParen(str: string, start: number): number {
  if (str[start] !== "(") return -1;
  let depth = 1;
  for (let i = start + 1; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Columnas de un bloque CREATE TABLE con flag PK (inline o PRIMARY KEY (...)). */
function parseColumnsFromCreateTableBlock(block: string): Array<{ name: string; pk: boolean }> {
  const columns: Array<{ name: string; pk: boolean }> = [];
  const openParen = block.indexOf("(");
  const closeParen = findMatchingParen(block, openParen);
  const inner = openParen !== -1 && closeParen !== -1 ? block.slice(openParen + 1, closeParen) : block;

  COL_DEF_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COL_DEF_REGEX.exec(inner)) !== null) {
    const colName = m[1].toLowerCase();
    const rest = inner.slice(m.index);
    const pk = /\bPRIMARY\s+KEY\b/i.test(rest);
    columns.push({ name: colName, pk });
  }

  const pkOnlyLine = inner.match(/\bPRIMARY\s+KEY\s*\(\s*([^)]+)\s*\)/gi);
  if (pkOnlyLine && columns.length > 0) {
    for (const pkLine of pkOnlyLine) {
      const namesMatch = pkLine.match(/\(\s*([^)]+)\s*\)/);
      if (!namesMatch) continue;
      const names = namesMatch[1].split(/\s*,\s*/).map((n) => n.trim().toLowerCase());
      for (const name of names) {
        const col = columns.find((c) => c.name === name);
        if (col) col.pk = true;
      }
    }
  }

  return columns;
}

const KEY_FIELD_PRIORITY = /^(id|uuid|status|state|estado|name|nombre|title|email|code)$/i;

/** Ordena columnas para `resolve_component`: PK primero, luego campos semánticos frecuentes. */
export function pickKeyFieldsFromColumns(columns: Array<{ name: string; pk: boolean }>): string[] {
  if (columns.length === 0) return ["id"];

  const pk = columns.filter((c) => c.pk).map((c) => c.name);
  const nonPk = columns.filter((c) => !c.pk).map((c) => c.name);

  const prioritized = [
    ...pk,
    ...nonPk.filter((n) => KEY_FIELD_PRIORITY.test(n)),
    ...nonPk.filter((n) => !KEY_FIELD_PRIORITY.test(n)),
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of prioritized) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 8) break;
  }
  return out.length > 0 ? out : ["id"];
}

/** Mapa tabla → keyFields a partir de SQL (`CREATE TABLE …`). */
export function parseCreateTableKeyFields(sql: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const tableBlocks = sql.split(/CREATE\s+TABLE/gi);
  for (let i = 1; i < tableBlocks.length; i++) {
    const block = tableBlocks[i];
    const tableNameMatch = block.match(/^\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|'|public\.)?(\w+)(?:`|"|')?/i);
    const tableName = tableNameMatch?.[1];
    if (!tableName) continue;
    const columns = parseColumnsFromCreateTableBlock(block);
    result.set(tableName, pickKeyFieldsFromColumns(columns));
    result.set(tableName.toLowerCase(), result.get(tableName)!);
  }
  return result;
}

/**
 * Extrae keyFields por entidad §3 (insumo de `resolve_component` en modo Forge).
 * Fallback `['id']` si la tabla no tiene columnas parseables.
 */
export function extractEntityKeyFieldsFromMdd(rawMdd: string): Map<string, string[]> {
  const mdd = normalizeGluedSection3Headings((rawMdd ?? "").trim());
  if (!mdd) return new Map();

  const section3 = extractSection3Body(mdd);
  if (section3) {
    const parsed = parseModeloDatosFromSection3Markdown(section3);
    if (parsed?.sql) {
      const fromSql = parseCreateTableKeyFields(parsed.sql);
      if (fromSql.size > 0) return fromSql;
    }
    const fromSection = parseCreateTableKeyFields(section3);
    if (fromSection.size > 0) return fromSection;
  }

  return parseCreateTableKeyFields(mdd);
}

/**
 * Extrae entidades de §3 con tolerancia a MDD mal formateado:
 * heading pegado, SQL fuera de ```sql, o §3 no detectable → fallback en todo el documento.
 */
export function extractEntityNamesFromMdd(rawMdd: string): string[] {
  const mdd = normalizeGluedSection3Headings((rawMdd ?? "").trim());
  if (!mdd) return [];

  const section3 = extractSection3Body(mdd);
  if (section3) {
    const parsed = parseModeloDatosFromSection3Markdown(section3);
    if (parsed?.sql) {
      const fromSql = parseCreateTableNames(parsed.sql);
      if (fromSql.length > 0) return fromSql;
    }
    const fromSection = parseCreateTableNames(section3);
    if (fromSection.length > 0) return fromSection;
  }

  return parseCreateTableNames(mdd);
}

interface ProjectMddSource {
  complexity?: ComplexityLevel | null;
  dbgaContent?: string | null;
  phase0SummaryContent?: string | null;
  specContent?: string | null;
  stages?: Array<{ ordinal: number; workflowStatus: StageStatus; mddContent?: string | null }>;
}

/** Misma fuente que `ProjectsService.constitutionMarkdown` (insumo canónico del MDD). */
export function resolveConstitutionMarkdown(project: ProjectMddSource): string {
  const stages = project.stages ?? [];
  const mdd = (pickPrimaryStage(stages)?.mddContent ?? "").trim();
  if (mdd.length > 0) return mdd;

  const cx = project.complexity ?? ComplexityLevel.HIGH;
  if (cx === ComplexityLevel.LOW || cx === ComplexityLevel.MEDIUM) {
    return [
      (project.dbgaContent ?? "").trim(),
      (project.phase0SummaryContent ?? "").trim(),
      (project.specContent ?? "").trim(),
    ]
      .filter((p) => p.length > 0)
      .join("\n\n---\n\n");
  }
  return "";
}
