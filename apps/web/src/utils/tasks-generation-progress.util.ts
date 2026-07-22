import type { TasksPipelineProgress } from "@theforge/shared-types";
import type { AgentProgressItem } from "./agentProgress";

const TASKS_PROGRESS_STEPS = ["planner", "redactor", "auditor", "repair"] as const;

const TASKS_STEP_LABELS: Record<(typeof TASKS_PROGRESS_STEPS)[number], string> = {
  planner: "Planificar cobertura",
  redactor: "Redactar documento",
  auditor: "Auditar calidad",
  repair: "Reparar y aprender",
};

export function createTasksGenerationProgressItems(): AgentProgressItem[] {
  return TASKS_PROGRESS_STEPS.map((step, index) => ({
    agent: "Tasks",
    step,
    message: index === 0 ? "⚡ Generando…" : "⚪ Pendiente",
    status: index === 0 ? ("generando" as const) : undefined,
  }));
}

function stepIndex(phase: TasksPipelineProgress["phase"]): number {
  return TASKS_PROGRESS_STEPS.indexOf(phase);
}

export function applyTasksPipelineProgress(
  prev: readonly AgentProgressItem[],
  progress: TasksPipelineProgress,
): AgentProgressItem[] {
  const activeIndex = Math.max(0, stepIndex(progress.phase));
  const batchSuffix =
    progress.phase === "redactor" && progress.batch != null && progress.totalBatches != null
      ? ` (${progress.batch}/${progress.totalBatches})`
      : progress.phase === "repair" && progress.repairAttempt != null && progress.maxRepairs != null
        ? ` (${progress.repairAttempt}/${progress.maxRepairs})`
        : "";

  return prev.map((item, index) => {
    const step = TASKS_PROGRESS_STEPS[index];
    if (!step) return item;
    const label = TASKS_STEP_LABELS[step];
    if (index < activeIndex) {
      return { ...item, message: "✅ Terminado", status: "terminado" as const };
    }
    if (index === activeIndex) {
      const detail = progress.message?.trim() || `${label}${batchSuffix}`;
      return {
        ...item,
        message: `⚡ ${detail}`,
        status: "generando" as const,
      };
    }
    return { ...item, message: "⚪ Pendiente", status: undefined };
  });
}

export function completeTasksGenerationProgressItems(): AgentProgressItem[] {
  return TASKS_PROGRESS_STEPS.map((step) => ({
    agent: "Tasks",
    step,
    message: "✅ Terminado",
    status: "terminado" as const,
  }));
}
