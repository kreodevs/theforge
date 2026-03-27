import { Injectable } from "@nestjs/common";
import { ComplexityLevel, Status } from "@theforge/database";
import { mddJsonSchema, type MddJson } from "@theforge/shared-types";

/** Longitud mínima (caracteres no vacíos) para considerar un entregable “presente”. */
const MIN_DELIVERABLE_LEN = 48;

export type SemaphoreDeliverablesSnapshot = {
  specContent: string | null;
  useCasesContent: string | null;
  userStoriesContent: string | null;
  tasksContent: string | null;
  apiContractsContent: string | null;
  uxUiGuideContent: string | null;
  logicFlowsContent: string | null;
  infraContent: string | null;
};

export type SemaphoreEvaluationInput = {
  complexity: ComplexityLevel;
  hasUxTeam: boolean;
  figmaMapping?: unknown;
  /** JSON string normalizado del MDD (solo aplica al camino HIGH). */
  mddJsonString: string | null;
  deliverables: SemaphoreDeliverablesSnapshot;
  /**
   * Si es true, el Grafo SDD (FalkorDB) no reporta dependencias huérfanas entre API_Endpoint y DB_Entity
   * para la etapa; en HIGH puede sustituir la puerta rígida edge_cases/field_types (§3–§5) hacia VERDE.
   */
  sddDomainGraphOk?: boolean;
};

function substantial(s: string | null | undefined): boolean {
  return typeof s === "string" && s.trim().length >= MIN_DELIVERABLE_LEN;
}

function figmaGateOk(hasUxTeam: boolean, figmaMapping: unknown): boolean {
  return hasUxTeam ? figmaMapping != null : true;
}

/**
 * Puertas de calidad dinámicas según ComplexityLevel:
 * - LOW: Historias de usuario + tareas (sin exigir MDD).
 * - MEDIUM: Spec o casos de uso, contratos API, guía UX/flujos (al menos uno de cada par donde aplica), tareas.
 * - HIGH: regla histórica del MDD en JSON (entidades, negocio, edge cases, field_types) + Figma si hay equipo UX.
 */
@Injectable()
export class SemaphoreService {
  evaluate(input: SemaphoreEvaluationInput): { status: Status; precisionScore: number } {
    switch (input.complexity) {
      case ComplexityLevel.LOW:
        return this.evaluateLow(input);
      case ComplexityLevel.MEDIUM:
        return this.evaluateMedium(input);
      case ComplexityLevel.HIGH:
      default:
        return this.evaluateHigh(input);
    }
  }

  private evaluateLow(input: SemaphoreEvaluationInput): { status: Status; precisionScore: number } {
    const { userStoriesContent, tasksContent } = input.deliverables;
    const hasHu = substantial(userStoriesContent);
    const hasTasks = substantial(tasksContent);

    if (!figmaGateOk(input.hasUxTeam, input.figmaMapping)) {
      return { status: Status.AMARILLO, precisionScore: 85 };
    }

    if (hasHu && hasTasks) {
      return { status: Status.VERDE, precisionScore: 95 };
    }

    if (hasHu || hasTasks) {
      return { status: Status.AMARILLO, precisionScore: 70 };
    }

    return { status: Status.ROJO, precisionScore: 25 };
  }

  private evaluateMedium(input: SemaphoreEvaluationInput): { status: Status; precisionScore: number } {
    const d = input.deliverables;
    const hasSpecOrUc = substantial(d.specContent) || substantial(d.useCasesContent);
    const hasApi = substantial(d.apiContractsContent);
    const hasUxOrFlows = substantial(d.uxUiGuideContent) || substantial(d.logicFlowsContent);
    const hasTasks = substantial(d.tasksContent);

    if (!figmaGateOk(input.hasUxTeam, input.figmaMapping)) {
      return { status: Status.AMARILLO, precisionScore: 85 };
    }

    const gates = [hasSpecOrUc, hasApi, hasUxOrFlows, hasTasks];
    const okCount = gates.filter(Boolean).length;

    if (okCount === 4) {
      return { status: Status.VERDE, precisionScore: 95 };
    }
    if (okCount >= 2) {
      return { status: Status.AMARILLO, precisionScore: 70 };
    }
    return { status: Status.ROJO, precisionScore: 30 };
  }

  private evaluateHigh(input: SemaphoreEvaluationInput): { status: Status; precisionScore: number } {
    const mddContent = input.mddJsonString;
    const hasUxTeam = input.hasUxTeam;
    const figmaMapping = input.figmaMapping;
    const graphRelief = input.sddDomainGraphOk === true;

    if (!mddContent?.trim()) {
      return { status: Status.ROJO, precisionScore: 0 };
    }

    let parsed: MddJson;
    try {
      const json = JSON.parse(mddContent) as unknown;
      parsed = mddJsonSchema.parse(json);
    } catch {
      return { status: Status.ROJO, precisionScore: 0 };
    }

    const entities = parsed.db_entities ?? [];
    const hasEntities = entities.length > 0;
    const hasBusinessCore =
      parsed.business_core != null && typeof parsed.business_core === "string" && parsed.business_core.trim().length > 0;
    const hasEdgeCases =
      parsed.edge_cases != null && typeof parsed.edge_cases === "string" && parsed.edge_cases.trim().length > 0;

    const fieldStr =
      parsed.field_types != null && typeof parsed.field_types === "string"
        ? parsed.field_types
        : typeof parsed.field_types === "object" && parsed.field_types !== null
          ? JSON.stringify(parsed.field_types)
          : "";
    const hasFieldTypes =
      fieldStr.length > 50 || (fieldStr.trim().length >= 8 && /inferred|detected|markdown/i.test(fieldStr.trim()));

    if (!hasEntities || !hasBusinessCore) {
      return { status: Status.ROJO, precisionScore: 30 };
    }

    const docGaps = !hasEdgeCases || !hasFieldTypes;
    if (docGaps && !graphRelief) {
      return { status: Status.AMARILLO, precisionScore: 70 };
    }

    const figmaOk = hasUxTeam ? figmaMapping != null : true;

    if (!figmaOk) {
      return { status: Status.AMARILLO, precisionScore: 85 };
    }

    const precisionScore = docGaps && graphRelief ? 92 : 95;
    return { status: Status.VERDE, precisionScore };
  }
}
