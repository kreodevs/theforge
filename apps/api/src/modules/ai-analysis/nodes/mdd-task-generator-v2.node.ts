import type { MDDStateType } from "../state/index.js";
import { parseTasksV2 } from "../../engine/task-v2/tasks-parser-v2.js";
import { inferTasks } from "../../engine/task-v2/inference-engine.js";

/**
 * Nodo LangGraph: Genera tasks v2 a partir de typesJson + operationsJson.
 * Recupera tasks.md generado por el LLM (si existe en state.mddStructured o state.mddDraft)
 * y lo enriquece con inference engine.
 *
 * Si no hay typesJson u operationsJson, devuelve el estado sin cambios (fail-safe).
 */
export function createMddTaskGeneratorV2Node() {
  return async function taskGeneratorV2Node(
    state: MDDStateType,
  ): Promise<Partial<MDDStateType>> {
    const typesJson = state.typesJson;
    const operationsJson = state.operationsJson;

    console.log(`[task-gen-v2] START hasTypes=${!!typesJson} hasOps=${!!operationsJson} entities=${typesJson?.entities?.length ?? 0}`);

    if (
      !typesJson ||
      !operationsJson ||
      !Array.isArray(typesJson.entities) ||
      typesJson.entities.length === 0
    ) {
      console.log(`[task-gen-v2] SKIP missing typesJson or operationsJson`);
      return {
        tasksJson: undefined,
        inferenceRulesApplied: [
          ...(state.inferenceRulesApplied ?? []),
          "[task-gen-v2] missing typesJson or operationsJson — skipped",
        ],
      };
    }

    try {
      // Intentar extraer tasks.md del mddDraft (buscando sección de tasks o anexos)
      const draft = (state.mddDraft ?? "").trim();
      let existingTasks: any = { tasks: [] };

      // Heurística: buscar bloques ```yaml o bloques de tasks en el draft
      const tasksBlockMatch = draft.match(
        /##\s*(?:Anexo\s+T|Tasks?|Plan\s+de\s+Implementaci[oó]n)[\s\S]*?```(?:yaml)?\s*\n([\s\S]*?)```/i,
      );
      if (tasksBlockMatch) {
        const parsed = parseTasksV2(tasksBlockMatch[1]);
        if (parsed.tasks.length > 0) {
          existingTasks = parsed;
        }
      }

      console.log(`[task-gen-v2] existingTasks=${existingTasks.tasks.length}`);

      // Enriquecer con inference engine
      const inferred = inferTasks({
        typesJson,
        operationsJson,
        existingTasks: existingTasks.tasks,
        stage: state.activeStageId ?? "unknown",
      });

      console.log(`[task-gen-v2] inferredTasks=${inferred.inferredTasks.length} coverage=${inferred.coverage.coveragePercent}%`);

      const mergedTasks = {
        version: "2.0",
        generatedAt: new Date().toISOString(),
        tasks: [...existingTasks.tasks, ...inferred.inferredTasks.map((i) => i.task)],
        coverage: {
          crudScore: inferred.coverage.coveragePercent,
          testScore: inferred.coverage.tasksExplicit > 0 ? 80 : 0,
          totalEntities: typesJson.entities?.length ?? 0,
          totalTasks: existingTasks.tasks.length + inferred.inferredTasks.length,
        },
      };

      console.log(`[task-gen-v2] DONE totalTasks=${mergedTasks.tasks.length}`);
      return {
        tasksJson: mergedTasks as any,
        inferenceRulesApplied: [
          ...(state.inferenceRulesApplied ?? []),
          "[task-gen-v2] tasks generated and enriched",
          `[task-gen-v2] coverage: crud=${mergedTasks.coverage.crudScore}% tasks=${mergedTasks.coverage.totalTasks}`,
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[task-gen-v2] ERROR: ${message}`);
      return {
        tasksJson: undefined,
        inferenceRulesApplied: [
          ...(state.inferenceRulesApplied ?? []),
          `[task-gen-v2] generation failed: ${message}`,
        ],
      };
    }
  };
}
