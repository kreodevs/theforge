import type { MDDStateType } from "../state/index.js";
import { auditTasks } from "../../engine/task-v2/task-auditor.js";

/**
 * Nodo LangGraph: Audita la calidad de los tasks generados en v2.
 * Devuelve un score 0-100 y feedback. Si no hay tasksJson, pasa sin cambios.
 *
 * Contrato: este nodo NUNCA bloquea el flujo. Solo registra score.
 */
export function createMddTaskAuditorNode() {
  return async function taskAuditorNode(
    state: MDDStateType,
  ): Promise<Partial<MDDStateType>> {
    const tasksJson = state.tasksJson;

    if (!tasksJson || !Array.isArray(tasksJson.tasks) || tasksJson.tasks.length === 0) {
      return {
        tasksAuditScore: undefined,
        inferenceRulesApplied: [
          ...(state.inferenceRulesApplied ?? []),
          "[task-auditor] no tasksJson to audit — skipped",
        ],
      };
    }

    try {
      const audit = auditTasks(tasksJson as any);

      const items = [
        ...audit.errors.slice(0, 3).map((e) => `[task-auditor] error: ${e.message}`),
        ...audit.warnings.slice(0, 3).map((w) => `[task-auditor] warning: ${w.message}`),
      ];

      const applied = [
        ...(state.inferenceRulesApplied ?? []),
        `[task-auditor] score=${audit.score}/100 ${audit.passed ? "PASSED" : "NEEDS_IMPROVEMENT"}`,
        ...items,
      ];

      return {
        tasksAuditScore: audit.score,
        inferenceRulesApplied: applied,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        tasksAuditScore: undefined,
        inferenceRulesApplied: [
          ...(state.inferenceRulesApplied ?? []),
          `[task-auditor] audit failed: ${message}`,
        ],
      };
    }
  };
}
