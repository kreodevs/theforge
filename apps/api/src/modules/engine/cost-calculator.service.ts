import { Injectable } from "@nestjs/common";
import type { TeamStructure } from "@theforge/shared-types";
import {
  computeCostEstimation,
  getDefaultTeamStructure as getDefaultTeamStructureCore,
  type CostEstimationInput,
} from "@theforge/business-rules";

export { parseInfraFixedHours } from "@theforge/business-rules";

export type EstimationInput = CostEstimationInput;

export interface EstimationResult {
  totalHours: number;
  totalMxn: number;
  teamStructure: TeamStructure;
}

@Injectable()
export class CostCalculatorService {
  /**
   * Estimación final (reglas en `@theforge/business-rules`).
   * Base = Entidades×12 + Pantallas×16 + Endpoints extra×4;
   * multiplicadores TechnicalMetadata; buffer si semáforo ≠ VERDE;
   * Total MXN = horas × tarifa única.
   */
  calculate(input: EstimationInput): EstimationResult {
    return computeCostEstimation(input);
  }

  getDefaultTeamStructure(entityCount: number, screenCount: number): TeamStructure {
    return getDefaultTeamStructureCore(entityCount, screenCount);
  }
}
