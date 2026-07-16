import {
  readTasksQualitySnapshot,
  TASKS_LLM_AUDITOR_PASS_THRESHOLD,
} from "@theforge/shared-types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";

type TasksQualityBadgeProps = {
  shortTermContext: unknown;
  className?: string;
};

/** Badge de calidad Tasks (snapshot en `Stage.shortTermContext.tasksQualitySnapshot`). */
export function TasksQualityBadge({ shortTermContext, className }: TasksQualityBadgeProps) {
  const snapshot = readTasksQualitySnapshot(shortTermContext);
  if (!snapshot) return null;

  const ok = snapshot.passed && snapshot.llmAuditorScore >= TASKS_LLM_AUDITOR_PASS_THRESHOLD;
  const capturedLabel = (() => {
    const d = new Date(snapshot.capturedAt);
    return Number.isNaN(d.getTime()) ? snapshot.capturedAt : d.toLocaleString();
  })();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums",
            ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
            className,
          )}
          aria-label={`Calidad Tasks: ${snapshot.llmAuditorScore}/100${ok ? ", aprobado" : ", revisar"}`}
        >
          {ok ? "Tasks OK" : "Tasks revisar"} {snapshot.llmAuditorScore}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-[18rem] text-xs">
        <p>
          Auditor LLM {snapshot.llmAuditorScore}/{TASKS_LLM_AUDITOR_PASS_THRESHOLD} · determinista{" "}
          {snapshot.deterministicScore}
        </p>
        <p>
          Tareas {snapshot.taskCount} · planner {snapshot.plannerItemCount} · reparaciones{" "}
          {snapshot.repairAttempts}
        </p>
        <p className="text-muted-foreground">{capturedLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
