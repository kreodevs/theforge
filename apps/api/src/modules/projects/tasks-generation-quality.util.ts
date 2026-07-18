/**
 * Evaluación de calidad de tasks.md tras generación LLM.
 * Combina TaskAccuracy (PLAN-CASCADE-90) y task-auditor (YAML v2 + dominio).
 */

import { CASCADE_ACCURACY_THRESHOLD } from "@theforge/shared-types";
import type { DomainInventory } from "@theforge/shared-types";
import { computeTaskAccuracy } from "../engine/cascade-accuracy.util.js";
import { auditTasks } from "../engine/task-v2/task-auditor.js";
import { parseTasksV2 } from "../engine/task-v2/tasks-parser-v2.js";
import { formatPrecisionGapsFeedback } from "../engine/sdd-precision-checks.util.js";
import { evaluateTasksStructure } from "./tasks-generation-structure.util.js";

export const TASKS_QUALITY_THRESHOLD = CASCADE_ACCURACY_THRESHOLD;

export type TasksQualityReport = {
  ok: boolean;
  score: number;
  accuracyScore: number;
  auditScore: number;
  taskCount: number;
  feedback: string | null;
};

export function evaluateTasksGenerationQuality(params: {
  tasksMarkdown: string;
  mddMarkdown: string;
  brdMarkdown?: string | null;
  dbgaMarkdown?: string | null;
  inventory?: DomainInventory | null;
  uiScreensMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  infraMarkdown?: string | null;
  userStoriesMarkdown?: string | null;
}): TasksQualityReport {
  const tasksMarkdown = (params.tasksMarkdown ?? "").trim();
  if (tasksMarkdown.length < 48) {
    return {
      ok: false,
      score: 0,
      accuracyScore: 0,
      auditScore: 0,
      taskCount: 0,
      feedback: formatPrecisionGapsFeedback([
        "Tasks vacío o demasiado corto tras generación; reintenta con cobertura §1–§7 y un ítem por endpoint/entidad MVP.",
      ]),
    };
  }

  const parsed = parseTasksV2(tasksMarkdown);
  const taskCount = parsed.tasks.length;

  const accuracy = computeTaskAccuracy({
    brdMarkdown: params.brdMarkdown,
    dbgaMarkdown: params.dbgaMarkdown,
    mddMarkdown: params.mddMarkdown,
    tasksMarkdown,
    inventory: params.inventory ?? undefined,
  });

  const audit = auditTasks(parsed, params.inventory ?? undefined, {
    requireStoryRef: (params.userStoriesMarkdown ?? "").trim().length >= 80,
  });
  const structure = evaluateTasksStructure({
    tasksMarkdown,
    uiScreensMarkdown: params.uiScreensMarkdown,
    apiContractsMarkdown: params.apiContractsMarkdown,
    mddMarkdown: params.mddMarkdown,
    infraMarkdown: params.infraMarkdown,
  });
  const score = Math.round(accuracy.score * 0.55 + audit.score * 0.45);
  const ok =
    accuracy.ok &&
    audit.passed &&
    structure.ok &&
    score >= TASKS_QUALITY_THRESHOLD;

  if (ok) {
    return {
      ok: true,
      score,
      accuracyScore: accuracy.score,
      auditScore: audit.score,
      taskCount,
      feedback: null,
    };
  }

  const gaps: string[] = [];
  if (!accuracy.ok) {
    gaps.push(`TaskAccuracy=${accuracy.score} < ${TASKS_QUALITY_THRESHOLD}`);
    gaps.push(
      ...accuracy.blockers,
      ...accuracy.components.flatMap((c) => c.gaps),
    );
  }
  if (!audit.passed) {
    gaps.push(`TaskAuditor=${audit.score} (errores=${audit.errors.length}, warnings=${audit.warnings.length})`);
    gaps.push(...audit.errors.map((e) => e.message));
    gaps.push(...audit.warnings.slice(0, 6).map((w) => w.message));
  }
  if (taskCount < 5 && tasksMarkdown.length > 500) {
    gaps.push(`Solo ${taskCount} tareas parseadas (v2/v1); se esperan más ítems para MVP completo.`);
  }
  if (!structure.ok) {
    gaps.push(...structure.gaps);
  }

  const unique = [...new Set(gaps.map((g) => g.trim()).filter(Boolean))].slice(0, 18);
  return {
    ok: false,
    score,
    accuracyScore: accuracy.score,
    auditScore: audit.score,
    taskCount,
    feedback: formatPrecisionGapsFeedback(unique),
  };
}
