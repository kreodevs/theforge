import type { MDDStateType } from "../state/index.js";
import {
  extractTypesFromMddSection3,
  extractOperationsFromMdd,
} from "../../engine/mdd-extractors/index.js";
import {
  extractSection3Body,
  extractSection4Body,
} from "../utils/mdd-sanitize.js";

/**
 * Nodo LangGraph: Deriva specs estructuradas (types.json + operations.json)
 * desde el mddDraft ya generado. Ejecuta como paso determinístico post-auditoría.
 *
 * Si el MDD no tiene secciones 3 o 4 sustanciales, devuelve el estado sin cambios
 * para no bloquear el grafo (fail-safe).
 */
export function createMddDerivedSpecGeneratorNode() {
  return async function derivedSpecGeneratorNode(
    state: MDDStateType,
  ): Promise<Partial<MDDStateType>> {
    const draft = (state.mddDraft ?? "").trim();
    if (draft.length < 200) {
      // MDD demasiado corto para extraer estructuras
      return {
        typesJson: undefined,
        operationsJson: undefined,
        inferenceRulesApplied: ["[derived-spec] mddDraft too short — skipped"],
      };
    }

    const s3 = extractSection3Body(draft);
    const s4 = extractSection4Body(draft);

    if (!s3 || s3.length < 50) {
      return {
        typesJson: undefined,
        operationsJson: undefined,
        inferenceRulesApplied: ["[derived-spec] §3 missing or too short — skipped"],
      };
    }

    try {
      const typesJson = extractTypesFromMddSection3(s3);
      const operationsJson = s4 && s4.length >= 50
        ? extractOperationsFromMdd(s3, s4, typesJson)
        : { version: "1.0", entities: [], globalFeatures: {} };

      const applied: string[] = [];
      // Casteamos globalFeatures para evitar errores de tipo cuando el schema devuelve {} por defecto
      const gf = (operationsJson.globalFeatures ?? {}) as Record<string, any>;
      if (gf.softDelete?.enabled) {
        applied.push("[soft-delete] detected and enabled");
      }
      if (gf.audit?.enabled) {
        applied.push("[audit-auto] detected and enabled");
      }
      if (gf.pagination?.defaultPageSize) {
        applied.push("[pagination-default] detected and enabled");
      }
      if (gf.rbac?.enabled) {
        applied.push("[rbac-auto] detected and enabled");
      }
      if (gf.search?.enabled) {
        applied.push("[search-auto] detected and enabled");
      }

      return {
        typesJson: typesJson as any,
        operationsJson: operationsJson as any,
        inferenceRulesApplied: applied,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        typesJson: undefined,
        operationsJson: undefined,
        inferenceRulesApplied: [`[derived-spec] extraction failed: ${message}`],
      };
    }
  };
}
