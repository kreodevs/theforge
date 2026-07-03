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
