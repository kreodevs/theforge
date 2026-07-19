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

/**
 * Estima el número mínimo de tasks esperado según la complejidad del proyecto.
 * Basado en: blueprint phases, endpoints API, entidades MDD §3, pantallas, infra services.
 */
function estimateMinimumTaskCount(params: {
  mddMarkdown: string;
  blueprintMarkdown?: string | null;
  apiContractsMarkdown?: string | null;
  uiScreensMarkdown?: string | null;
  infraMarkdown?: string | null;
}): number {
  let minimum = 8; // baseline: setup, MDD §1, §3 modelo, §4 API, §5 lógica, §6 seguridad, §7 infra, QA

  // Blueprint phases: each phase → at least 5 tasks (backend, frontend, test, deploy, doc)
  const blueprint = (params.blueprintMarkdown ?? "").trim();
  if (blueprint.length > 200) {
    const phaseMatches = [...blueprint.matchAll(/^##\s+(?:(?:Fase|Phase|Roadmap|Milestone|Sprint|Hitos|Etapa)\s+\d+[^#\n]*)/gim)];
    if (phaseMatches.length > 1) {
      minimum += phaseMatches.length * 5;
    }
  }

  // API endpoints: each endpoint → at least 1 task
  const api = (params.apiContractsMarkdown ?? "").trim();
  if (api.length > 50) {
    const endpointCount = (api.match(/^###\s+(GET|POST|PUT|PATCH|DELETE)\s+/gim) ?? []).length;
    minimum += endpointCount;
  }

  // MDD §3 entities: each entity → at least 1 task
  const mdd = (params.mddMarkdown ?? "").trim();
  const entityMatches = mdd.match(/^\|[^|\n]+\|[^|\n]+\|[^|\n]+\|[^|\n]+\|$/gm) ?? [];
  if (entityMatches.length > 5) {
    minimum += Math.min(entityMatches.length, 30);
  }

  // UI screens: each route → at least 1 Frontend task
  const ui = (params.uiScreensMarkdown ?? "").trim();
  if (ui.length > 50) {
    const routeCount = (ui.match(/^[\s]*-?\s*\//gm) ?? []).length;
    minimum += Math.min(routeCount, 40);
  }

  // Infra services: Docker, Redis, PostgreSQL, etc.
  const infra = (params.infraMarkdown ?? "").trim();
  if (infra.length > 50) {
    minimum += 3;
  }

  return minimum;
}

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
  blueprintMarkdown?: string | null;
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

  // Minimum task count check: reject if significantly below expected
  const minimumTasks = estimateMinimumTaskCount(params);
  if (taskCount > 0 && taskCount < Math.ceil(minimumTasks * 0.4)) {
    return {
      ok: false,
      score: 0,
      accuracyScore: 0,
      auditScore: 0,
      taskCount,
      feedback: formatPrecisionGapsFeedback([
        `Tasks tiene ${taskCount} tareas pero el proyecto requiere al menos ${minimumTasks} (blueprint phases + endpoints + entidades + pantallas + infra). Regenerar con cobertura completa.`,
      ]),
    };
  }

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
  if (taskCount < minimumTasks * 0.6 && tasksMarkdown.length > 500) {
    gaps.push(`Solo ${taskCount} tareas parseadas (v2/v1); se esperan al menos ${minimumTasks} para proyecto con ${estimateMinimumTaskCount(params)} requerimientos.`);
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
