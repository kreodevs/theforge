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

    const taskCount = tasksJson?.tasks?.length ?? 0;
    console.log(`[task-auditor] START taskCount=${taskCount}`);

    if (!tasksJson || !Array.isArray(tasksJson.tasks) || tasksJson.tasks.length === 0) {
      console.log(`[task-auditor] SKIP no tasksJson`);
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
      console.log(`[task-auditor] DONE score=${audit.score} passed=${audit.passed} errors=${audit.errors.length} warnings=${audit.warnings.length}`);

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
      console.error(`[task-auditor] ERROR: ${message}`);
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
