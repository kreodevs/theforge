/**
 * Lógica de estimación final alineada con cost-calculator.service.ts del backend.
 * Base: Entidades×12 + Pantallas×16 + Endpoints extra×4.
 * Multiplicadores por TechnicalMetadata; horas fijas de infra; buffer 25% si semáforo ≠ VERDE.
 * Total MXN = Total Horas × $1,050/hr.
 */

const HOURS_PER_ENTITY = 12;
const HOURS_PER_SCREEN = 16;
const HOURS_PER_ENDPOINT = 4;
const RATE_MXN_PER_HOUR = 1050;
const BUFFER_FACTOR = 1.25;

const METADATA_MULTIPLIERS: Record<string, number> = {
  high_security: 1.25,
  external_api: 1.2,
  multi_tenant: 1.3,
  real_time: 1.15,
};

const METADATA_FIXED_HOURS: Record<string, number> = {
  cicd_pipeline: 8,
  advanced_monitoring: 10,
};

const KNOWN_METADATA_TAGS = [
  "high_security",
  "external_api",
  "multi_tenant",
  "real_time",
  "cicd_pipeline",
  "advanced_monitoring",
] as const;

export const RATES_MXN: Record<string, number> = {
  architect: 1500,
  back: 950,
  front: 850,
  ux: 750,
};

export interface TeamStructure {
  architect?: number;
  back?: number;
  front?: number;
  ux?: number;
}

export interface CostResult {
  totalHours: number;
  totalMxn: number;
  teamStructure: TeamStructure;
}

export type SemaphoreStatus = "ROJO" | "AMARILLO" | "VERDE";

export function getDefaultTeamStructure(
  entityCount: number,
  screenCount: number,
): TeamStructure {
  const complexity = entityCount + screenCount;
  return {
    architect: 1,
    back: complexity > 10 ? 2 : 1,
    front: complexity > 15 ? 2 : 1,
    ux: complexity > 8 ? 1 : 0,
  };
}

function extractTechnicalMetadataTags(mddContent: string | null): string[] {
  if (!mddContent?.trim()) return [];
  const content = mddContent.trim();
  const blockMatch = content.match(
    /(?:```\s*TechnicalMetadata|###\s*TechnicalMetadata|TechnicalMetadata\s*:?\s*)\s*([\s\S]*?)(?:```|$)/i,
  );
  const search = (blockMatch?.[1] ?? content) as string;
  const tags: string[] = [];
  const tagRegex = /\[\s*([a-z0-9_]+)\s*]/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(search)) !== null) {
    const tag = (m[1] ?? "").toLowerCase();
    if (KNOWN_METADATA_TAGS.includes(tag as (typeof KNOWN_METADATA_TAGS)[number]) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

function parseInfraFixedHours(infraContent: string | null): number {
  if (!infraContent?.trim()) return 0;
  const content = infraContent.trim();
  const sectionMatch = content.match(/(?:##?\s*Horas\s*fijas[\s\S]*?)(?=##|$)/i);
  const search = sectionMatch ? sectionMatch[0] : content;
  const regex = /(?:\+\s*)?(\d+)\s*(?:h|hrs?|horas?)\b/gi;
  let sum = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(search)) !== null) {
    const num = match[1];
    if (num != null) sum += parseInt(num, 10);
  }
  return sum;
}

/**
 * Parsea mddContent (JSON o markdown) para extraer entidades, pantallas y endpoints extra.
 */
export function parseMddCounts(mddContent: string | null): {
  entityCount: number;
  screenCount: number;
  extraEndpointCount: number;
} {
  if (!mddContent?.trim()) return { entityCount: 0, screenCount: 0, extraEndpointCount: 0 };
  try {
    const json = JSON.parse(mddContent) as {
      db_entities?: unknown[];
      screens?: unknown[];
      pantallas?: unknown[];
      extra_endpoints?: number;
    };
    const entityCount = json.db_entities?.length ?? 0;
    const screenCount = json.screens?.length ?? json.pantallas?.length ?? 0;
    const extraEndpointCount = typeof json.extra_endpoints === "number" ? json.extra_endpoints : 0;
    return { entityCount, screenCount, extraEndpointCount };
  } catch {
    return parseMarkdownMddCounts(mddContent);
  }
}

function parseMarkdownMddCounts(md: string): {
  entityCount: number;
  screenCount: number;
  extraEndpointCount: number;
} {
  const lines = md.split(/\r?\n/);
  const entities = new Set<string>();
  let extraEndpointCount = 0;
  let inDataModel = false;
  let inApi = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^#+\s*(\d\.)?\s*modelo de datos/i.test(line) || /^#+\s*3\./i.test(line) || lower.includes("modelo de datos")) {
      inDataModel = true;
      inApi = false;
      continue;
    }
    if (/^#+\s*(\d\.)?\s*contratos de api/i.test(line) || /^#+\s*4\./i.test(line) || lower.includes("contratos de api") || lower.includes("endpoints")) {
      inDataModel = false;
      inApi = true;
      continue;
    }
    if (inDataModel) {
      const m = line.match(/\*\*([A-Za-z][A-Za-z0-9_]*)\*\*\s*[:(]|^-\s*\*\*([A-Za-z][A-Za-z0-9_]*)\*\*|^([A-Za-z][A-Za-z0-9_]*)\s*\(/);
      if (m) {
        const name = (m[1] ?? m[2] ?? m[3])?.trim();
        if (name) entities.add(name);
      }
    }
    if (inApi && (/\/api\/|\/auth\//.test(line) || /\b(POST|GET|PUT|DELETE|PATCH)\b/.test(line))) {
      extraEndpointCount += 1;
    }
  }

  const entityCount = entities.size;
  const screenCount = extraEndpointCount > 0 ? 0 : (entityCount > 0 ? Math.min(entityCount * 2, 20) : 0);
  return { entityCount, screenCount, extraEndpointCount };
}

/**
 * Calcula la estimación final a partir del MDD (y opcionalmente infra y semáforo).
 * Si status no es VERDE se aplica buffer 25%. Total MXN = totalHours × $1,050/hr.
 */
export function calculateCostFromMdd(
  mddContent: string | null,
  options?: { status?: SemaphoreStatus; infraContent?: string | null },
): CostResult {
  const { entityCount, screenCount, extraEndpointCount } = parseMddCounts(mddContent);
  const metadataTags = extractTechnicalMetadataTags(mddContent);
  const infraFixedHours = parseInfraFixedHours(options?.infraContent ?? null);
  const status = options?.status ?? "ROJO";

  const baseHours =
    entityCount * HOURS_PER_ENTITY +
    screenCount * HOURS_PER_SCREEN +
    extraEndpointCount * HOURS_PER_ENDPOINT;

  let multiplier = 1;
  for (const tag of metadataTags) {
    const m = METADATA_MULTIPLIERS[tag];
    if (m != null) multiplier *= m;
  }

  let fixedHours = infraFixedHours;
  for (const tag of metadataTags) {
    const h = METADATA_FIXED_HOURS[tag];
    if (h != null) fixedHours += h;
  }

  let totalHours = baseHours * multiplier + fixedHours;
  if (status !== "VERDE") {
    totalHours *= BUFFER_FACTOR;
  }

  const totalMxn = totalHours * RATE_MXN_PER_HOUR;
  const teamStructure = getDefaultTeamStructure(entityCount, screenCount + extraEndpointCount);

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalMxn: Math.round(totalMxn * 100) / 100,
    teamStructure,
  };
}
