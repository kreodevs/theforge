/**
 * Parsea un MDD en markdown (generado por la IA) a una estructura JSON mínima
 * para que el semáforo y el cost calculator puedan evaluar y estimar.
 * El semáforo espera JSON con db_entities, business_core, edge_cases, field_types
 * y opcionalmente `constitution` (Constitución Cursor, solo puertas en HIGH si template_detected).
 */

import type { MddConstitutionSignals } from "@theforge/shared-types";

export interface ParsedMdd {
  db_entities: { name?: string }[];
  screens?: unknown[];
  /** Endpoints de API detectados en sección Contratos de API (para base 4h cada uno). */
  extra_endpoints?: number;
  business_core: string | null;
  edge_cases?: string;
  field_types?: string;
  constitution?: MddConstitutionSignals;
}

/** Extrae el cuerpo de `## N. …` hasta el siguiente `##` numerado (mismo nivel). */
export function extractSectionByNumber(md: string, sectionNum: number): string {
  const re = /^##\s*(\d+)\.\s*[^\n]*/gim;
  const matches: { num: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    matches.push({ num: parseInt(m[1]!, 10), index: m.index });
  }
  const idx = matches.findIndex((x) => x.num === sectionNum);
  if (idx === -1) return "";
  const start = matches[idx]!.index;
  const next = matches[idx + 1];
  const end = next ? next.index : md.length;
  return md.slice(start, end).trim();
}

/**
 * Heurísticas sobre §1–§2–§5 para alinear el semáforo HIGH con la plantilla «Constitución Cursor».
 * Si `template_detected` es false, `SemaphoreService` no aplica puertas extra (MDD legacy).
 */
export function extractConstitutionSignalsFromMarkdown(md: string): MddConstitutionSignals {
  const s1 = extractSectionByNumber(md, 1);
  const s2 = extractSectionByNumber(md, 2);
  const s5 = extractSectionByNumber(md, 5);

  const template_detected =
    /###\s*mapa\s+de\s+contextos/i.test(s1) ||
    /###\s*glosario\s+de\s+dominio/i.test(s1) ||
    /ubiquitous\s+language/i.test(s1) ||
    /lenguaje\s+ubicuo/i.test(s1);

  if (!template_detected) {
    return { template_detected: false };
  }

  const has_context_map =
    /en\s+alcance/i.test(s1) && /colindante/i.test(s1) && /fuera\s+de\s+alcance/i.test(s1);

  const glossMatch = s1.match(
    /###\s*(?:glosario\s+de\s+dominio|[^\n]*lenguaje\s+ubicuo[^\n]*|[^\n]*ubiquitous\s+language[^\n]*)\s*\n([\s\S]*?)(?=^###\s|^##\s*\d+\.|\z)/im,
  );
  const glossBody = (glossMatch?.[1] ?? "").trim();
  const has_glossary =
    glossBody.length >= 25 &&
    (/^[-*]|\n[-*]/.test(glossBody) || /^\|.+\|/m.test(glossBody) || /\*\*[^*]+\*\*\s*[|:]/.test(glossBody));

  const blockMatch = s1.match(
    /###\s*bloqueantes?\s+de\s+negocio[^\n]*\n([\s\S]*?)(?=^###\s|^##\s*2\.|\z)/im,
  );
  const blockBody = (blockMatch?.[1] ?? "").trim();
  const has_open_blockers =
    blockBody.length > 0 &&
    !/^[-*]?\s*ninguno\b/im.test(blockBody) &&
    !/^ninguno\.?\s*$/im.test(blockBody) &&
    !/^sin\s+bloqueantes/im.test(blockBody);

  const dado = /\bDado\b/i.test(s5) || /\bGiven\b/i.test(s5);
  const cuando = /\bCuando\b/i.test(s5) || /\bWhen\b/i.test(s5);
  const entonces = /\bEntonces\b/i.test(s5) || /\bThen\b/i.test(s5);
  const has_gherkin = s5.length > 80 && dado && cuando && entonces;
  const gherkin_scenario_count = Math.max(
    (s5.match(/\bDado\b/gi) ?? []).length,
    (s5.match(/\bGiven\b/gi) ?? []).length,
  );

  const has_stack_rationale =
    /¿Por\s*qué\s*\?/i.test(s2) ||
    /\*\*¿Por\s*qué\?\*\*/i.test(s2) ||
    /\*\*Decisión:\*\*/i.test(s2) ||
    /\*\*Decisión\s*:/i.test(s2) ||
    /\bADR\b/i.test(s2);

  return {
    template_detected: true,
    has_context_map,
    has_glossary,
    has_gherkin,
    gherkin_scenario_count: has_gherkin ? Math.max(1, gherkin_scenario_count) : 0,
    has_open_blockers,
    has_stack_rationale,
  };
}

function mergeConstitutionFromMarkdown(
  parsedJson: Record<string, unknown> | undefined,
  raw: string,
): MddConstitutionSignals {
  const fromMd = extractConstitutionSignalsFromMarkdown(raw);
  const fromJson = parsedJson?.constitution;
  if (fromJson && typeof fromJson === "object" && !Array.isArray(fromJson)) {
    return { ...fromMd, ...(fromJson as MddConstitutionSignals) };
  }
  return fromMd;
}

export function parseMarkdownMdd(md: string | null): ParsedMdd {
  const empty: ParsedMdd = {
    db_entities: [],
    business_core: null,
    edge_cases: "",
    field_types: "",
    extra_endpoints: 0,
    constitution: { template_detected: false },
  };
  if (!md?.trim()) return empty;

  const content = md.trim();
  const lines = content.split(/\r?\n/);

  const entities: string[] = [];
  let inDataModel = false;
  let inApi = false;
  const apiOrScreens: { path: string }[] = [];
  let hasBusinessLogic = false;
  let hasEdgeCases = false;
  let hasFieldTypes = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (
      /^#+\s*(\d\.)?\s*modelo de datos/i.test(line) ||
      /^#+\s*3\./i.test(line) ||
      lower.includes("modelo de datos")
    ) {
      inDataModel = true;
      inApi = false;
      continue;
    }
    if (
      /^#+\s*(\d\.)?\s*contratos de api/i.test(line) ||
      /^#+\s*4\./i.test(line) ||
      lower.includes("contratos de api") ||
      lower.includes("endpoints")
    ) {
      inDataModel = false;
      inApi = true;
      continue;
    }
    if (/^#+\s*(\d\.)?\s*(lógica|negocio)/i.test(line) || lower.includes("lógica de negocio")) {
      hasBusinessLogic = true;
    }
    if (/edge\s*cases|casos\s*límite|manejo de errores/i.test(lower)) {
      hasEdgeCases = true;
    }
    if (inDataModel && (lower.includes("uuid") || lower.includes("string") || lower.includes("integer") || /\*\*[^*]+\*\*:/.test(line))) {
      hasFieldTypes = true;
    }

    if (inDataModel) {
      const entityMatch = line.match(/\*\*([A-Za-z][A-Za-z0-9_]*)\*\*(?:\s*\([^)]*\))?\s*[:]?|^-\s*\*\*([A-Za-z][A-Za-z0-9_]*)\*\*|^([A-Za-z][A-Za-z0-9_]*)\s*\(/);
      if (entityMatch) {
        const name = (entityMatch[1] ?? entityMatch[2] ?? entityMatch[3])?.trim();
        if (name && !entities.includes(name)) entities.push(name);
      }
      if (!entityMatch && /\*\*[A-Za-z][A-Za-z0-9_]*\*\*/.test(line)) {
        const boldMatch = line.match(/\*\*([A-Za-z][A-Za-z0-9_]*)\*\*/);
        if (boldMatch?.[1] && !entities.includes(boldMatch[1])) entities.push(boldMatch[1]);
      }
    }
    if (inApi && (/\/api\/|\/auth\//.test(line) || /\b(POST|GET|PUT|DELETE|PATCH)\b/.test(line))) {
      apiOrScreens.push({ path: line.trim() });
    }
  }

  const hasSubstance = content.length > 400;
  const hasSections =
    /#+\s*[12]\.|contexto|arquitectura|modelo de datos|contratos de api|lógica de negocio|seguridad/i.test(content);

  let db_entities = entities.slice(0, 30).map((name) => ({ name }));
  if (db_entities.length === 0 && hasSubstance && hasSections) {
    db_entities = [{ name: "Documento" }];
  }

  const extra_endpoints = apiOrScreens.length;
  const screens =
    extra_endpoints > 0 ? [] : (db_entities.length > 0 ? Array(Math.min(db_entities.length * 2, 20)).fill({}) : []);

  const hasEntities = db_entities.length > 0;
  const business_core = hasBusinessLogic || (hasEntities && hasSubstance) ? "inferred from markdown" : null;
  const edge_cases = hasEdgeCases || (hasEntities && hasSubstance) ? "inferred" : "";
  const field_types = hasFieldTypes || (hasEntities && hasSubstance) ? "inferred" : "";

  return {
    db_entities,
    screens,
    extra_endpoints,
    business_core,
    edge_cases,
    field_types,
    constitution: extractConstitutionSignalsFromMarkdown(content),
  };
}

/**
 * Normaliza mddContent: si es JSON válido lo parsea; si no, parsea desde markdown.
 * Devuelve un objeto listo para semaphore + cost calculator.
 */
export function normalizeMddContent(mddContent: string | null): ParsedMdd & { screens?: unknown[] } {
  if (!mddContent?.trim()) {
    return {
      db_entities: [],
      business_core: null,
      edge_cases: "",
      field_types: "",
      extra_endpoints: 0,
      constitution: { template_detected: false },
    };
  }
  try {
    const json = JSON.parse(mddContent) as unknown;
    const parsed = json as Record<string, unknown>;
    const screens = Array.isArray(parsed.screens)
      ? parsed.screens
      : Array.isArray((parsed as { pantallas?: unknown[] }).pantallas)
        ? (parsed as { pantallas: unknown[] }).pantallas
        : [];
    const raw = mddContent.trim();
    return {
      db_entities: Array.isArray(parsed.db_entities) ? parsed.db_entities : [],
      screens,
      extra_endpoints: typeof parsed.extra_endpoints === "number" ? parsed.extra_endpoints : 0,
      business_core: parsed.business_core != null ? String(parsed.business_core) : null,
      edge_cases: parsed.edge_cases != null ? String(parsed.edge_cases) : "",
      field_types: parsed.field_types != null ? String(parsed.field_types) : "",
      constitution: mergeConstitutionFromMarkdown(parsed, raw),
    };
  } catch {
    return parseMarkdownMdd(mddContent);
  }
}

/** Etiquetas conocidas del bloque TechnicalMetadata en el MDD (master-prompt). */
const KNOWN_METADATA_TAGS = [
  "high_security",
  "external_api",
  "multi_tenant",
  "real_time",
  "cicd_pipeline",
  "advanced_monitoring",
] as const;

/**
 * Extrae etiquetas [tag] del bloque TechnicalMetadata en el MDD (markdown).
 * Busca bloque ```TechnicalMetadata o ### TechnicalMetadata y tags entre corchetes.
 */
export function extractTechnicalMetadataTags(mddContent: string | null): string[] {
  if (!mddContent?.trim()) return [];
  const content = mddContent.trim();
  const blockMatch = content.match(
    /(?:```\s*TechnicalMetadata|###\s*TechnicalMetadata|TechnicalMetadata\s*:?\s*)\s*([\s\S]*?)(?:```|$)/i,
  );
  const search = blockMatch ? blockMatch[1] : content;
  const tags: string[] = [];
  const tagRegex = /\[\s*([a-z0-9_]+)\s*]/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(search)) !== null) {
    const tag = m[1].toLowerCase();
    if (KNOWN_METADATA_TAGS.includes(tag as (typeof KNOWN_METADATA_TAGS)[number]) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}
