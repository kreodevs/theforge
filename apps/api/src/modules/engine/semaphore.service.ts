import { Injectable } from "@nestjs/common";
import { Status } from "@the-forge/database";
import { mddJsonSchema, type MddJson } from "@the-forge/shared-types";

/**
 * Criterios del semáforo (MDD en JSON o markdown normalizado):
 * - ROJO (0–30%): sin entidades o sin business_core.
 * - AMARILLO (70%): entidades + business_core pero faltan edge_cases o field_types.
 * - VERDE (95%): entidades, business_core, edge_cases y field_types presentes.
 * Si mddContent es markdown, ProjectsService lo normaliza con mdd-markdown-parser
 * antes de llamar a evaluate (entidades inferidas de "Modelo de Datos", etc.).
 */
@Injectable()
export class SemaphoreService {
  evaluate(mddContent: string | null, hasUxTeam: boolean, figmaMapping?: any): { status: Status; precisionScore: number } {
    if (!mddContent?.trim()) {
      return { status: Status.ROJO, precisionScore: 0 };
    }

    let parsed: MddJson;
    try {
      // Si recibes Markdown, necesitas que el parser sea MUY estricto
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

    // 1. ROJO: Sin cimientos
    if (!hasEntities || !hasBusinessCore) {
      return { status: Status.ROJO, precisionScore: 30 };
    }

    // 2. AMARILLO: Faltan detalles técnicos o casos de borde
    if (!hasEdgeCases || !hasFieldTypes) {
      return { status: Status.AMARILLO, precisionScore: 70 };
    }

    // 3. VALIDACIÓN DE UX (Sin el || true)
    // Si el usuario dijo que tiene equipo de UX, DEBE haber un mapping de Figma cargado
    const figmaOk = hasUxTeam ? (figmaMapping != null) : true;

    if (!figmaOk) {
      return { status: Status.AMARILLO, precisionScore: 85 }; // Bloqueado por falta de diseño
    }

    // 4. VERDE: Todo en orden
    return { status: Status.VERDE, precisionScore: 95 };
  }
}