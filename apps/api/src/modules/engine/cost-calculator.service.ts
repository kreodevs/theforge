import { Injectable } from "@nestjs/common";
import { Status } from "@the-forge/database";
import type { TeamStructure } from "@the-forge/shared-types";

const HOURS_PER_ENTITY = 12;
const HOURS_PER_SCREEN = 16;
const HOURS_PER_ENDPOINT = 4;
const RATE_MXN_PER_HOUR = 1050;
const BUFFER_FACTOR = 1.25;

/** Multiplicadores por etiqueta TechnicalMetadata (producto). */
const METADATA_MULTIPLIERS: Record<string, number> = {
  high_security: 1.25,
  external_api: 1.2,
  multi_tenant: 1.3,
  real_time: 1.15,
};

/** Horas fijas por etiqueta TechnicalMetadata (suma). */
const METADATA_FIXED_HOURS: Record<string, number> = {
  cicd_pipeline: 8,
  advanced_monitoring: 10,
};

export interface EstimationInput {
  entityCount: number;
  screenCount: number;
  extraEndpointCount: number;
  metadataTags: string[];
  infraFixedHours: number;
  status: Status;
}

export interface EstimationResult {
  totalHours: number;
  totalMxn: number;
  teamStructure: TeamStructure;
}

/**
 * Parsea el documento de infra (markdown) y suma las horas fijas.
 * Busca líneas con "+N h", "+N hrs", "N horas" o sección "Horas fijas" / "horas fijas".
 */
export function parseInfraFixedHours(infraContent: string | null): number {
  if (!infraContent?.trim()) return 0;
  const content = infraContent.trim();
  const sectionMatch = content.match(/(?:##?\s*Horas\s*fijas[\s\S]*?)(?=##|$)/i);
  const search = sectionMatch ? sectionMatch[0] : content;
  const regex = /(?:\+\s*)?(\d+)\s*(?:h|hrs?|horas?)\b/gi;
  let sum = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(search)) !== null) {
    sum += parseInt(m[1], 10);
  }
  return sum;
}

@Injectable()
export class CostCalculatorService {
  /**
   * Estimación final:
   * Base = Entidades×12 + Pantallas×16 + Endpoints extra×4.
   * Horas = Base × multiplicadores(TechnicalMetadata) + horas fijas(metadata) + infraFixedHours.
   * Si semáforo ≠ VERDE: Horas × 1.25 (buffer incertidumbre).
   * Total MXN = Total Horas × $1,050/hr.
   */
  calculate(input: EstimationInput): EstimationResult {
    const {
      entityCount,
      screenCount,
      extraEndpointCount,
      metadataTags,
      infraFixedHours,
      status,
    } = input;

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
    if (status !== Status.VERDE) {
      totalHours *= BUFFER_FACTOR;
    }

    const totalMxn = totalHours * RATE_MXN_PER_HOUR;
    const teamStructure = this.getDefaultTeamStructure(
      entityCount,
      screenCount + extraEndpointCount,
    );

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalMxn: Math.round(totalMxn * 100) / 100,
      teamStructure,
    };
  }

  getDefaultTeamStructure(entityCount: number, screenCount: number): TeamStructure {
    const complexity = entityCount + screenCount;
    return {
      architect: 1,
      back: complexity > 10 ? 2 : 1,
      front: complexity > 15 ? 2 : 1,
      ux: complexity > 8 ? 1 : 0,
    };
  }
}
