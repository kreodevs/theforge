import type { TasksLlmAuditorOutput } from "@theforge/shared-types";
import type { TasksQualityReport } from "./tasks-generation-quality.util.js";

export type TasksRedactorRetryFeedback = {
  gapsFeedback: string;
  tasksAuditorFeedback: string;
};

/** Une feedback determinista, auditor LLM y gaps externos en líneas únicas. */
export function composeTasksRepairFeedbackLines(
  quality: TasksQualityReport,
  llmAuditor: TasksLlmAuditorOutput,
  externalGaps?: string | null,
): string {
  const lines: string[] = [];
  if (externalGaps?.trim()) lines.push(externalGaps.trim());
  if (quality.feedback?.trim()) lines.push(quality.feedback.trim());
  if (llmAuditor.feedback?.trim()) lines.push(llmAuditor.feedback.trim());
  for (const g of llmAuditor.missing_coverage) lines.push(`Cobertura: ${g}`);
  for (const g of llmAuditor.conflicts) lines.push(`Conflicto: ${g}`);
  for (const g of llmAuditor.traceability_gaps) lines.push(`Trazabilidad: ${g}`);
  for (const g of llmAuditor.dependency_issues) lines.push(`Dependencia: ${g}`);
  for (const g of llmAuditor.executable_gaps) lines.push(`Ejecutabilidad: ${g}`);
  return [...new Set(lines.map((l) => l.trim()).filter(Boolean))].join("\n");
}

/** Resumen corto de un intento fallido para acumular "lecciones" entre reparaciones. */
export function summarizeTasksRepairAttempt(
  quality: TasksQualityReport,
  llmAuditor: TasksLlmAuditorOutput,
): string {
  const parts: string[] = [];
  if (quality.feedback?.trim()) {
    parts.push(quality.feedback.trim().split("\n")[0]!.slice(0, 160));
  }
  if (llmAuditor.score > 0) {
    parts.push(`auditor LLM ${llmAuditor.score}/100`);
  }
  const firstGap =
    llmAuditor.missing_coverage[0] ??
    llmAuditor.conflicts[0] ??
    llmAuditor.executable_gaps[0];
  if (firstGap) parts.push(String(firstGap).slice(0, 120));
  return parts.filter(Boolean).join(" — ");
}

/**
 * Feedback explícito para el redactor: "te equivocaste por X, repítelo pero aprende".
 * Separa correcciones accionables (gapsFeedback) del dictamen del auditor (tasksAuditorFeedback).
 */
export function composeTasksRedactorRetryFeedback(params: {
  repairAttempt: number;
  maxRepairs: number;
  repairFeedbackLines: string;
  llmAuditor: TasksLlmAuditorOutput;
  priorAttemptSummaries: string[];
  documentTruncated: boolean;
}): TasksRedactorRetryFeedback {
  const {
    repairAttempt,
    maxRepairs,
    repairFeedbackLines,
    llmAuditor,
    priorAttemptSummaries,
    documentTruncated,
  } = params;

  const preambleLines = [
    `**Intento anterior RECHAZADO** (${repairAttempt}/${maxRepairs}).`,
    "",
    "Regenera el documento Tasks **COMPLETO** desde cero según el plan JSON aprobado.",
    "No parchees el borrador anterior: corrige los errores listados abajo.",
    documentTruncated
      ? "El borrador anterior estaba **truncado** (YAML sin cerrar o documento cortado). " +
          "Cierra cada bloque `---` y completa todas las tareas del plan."
      : null,
    "",
    "**Errores que debes corregir en esta regeneración:**",
    repairFeedbackLines.trim() || "(sin detalle adicional — revisa checklist upstream y plan JSON)",
  ].filter((line): line is string => line != null);

  let gapsFeedback = preambleLines.join("\n");
  if (priorAttemptSummaries.length > 0) {
    gapsFeedback +=
      "\n\n**Errores que NO debes repetir (intentos previos):**\n" +
      priorAttemptSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n");
  }

  const auditorLines: string[] = [];
  if (llmAuditor.feedback?.trim()) {
    auditorLines.push(llmAuditor.feedback.trim());
  }
  auditorLines.push(
    `Puntuación auditor: ${llmAuditor.score}/100 (umbral mínimo requerido tras regeneración).`,
  );
  if (llmAuditor.missing_coverage.length > 0) {
    auditorLines.push(
      "Cobertura faltante:\n" + llmAuditor.missing_coverage.map((g) => `- ${g}`).join("\n"),
    );
  }
  if (llmAuditor.conflicts.length > 0) {
    auditorLines.push("Conflictos:\n" + llmAuditor.conflicts.map((g) => `- ${g}`).join("\n"));
  }
  if (llmAuditor.executable_gaps.length > 0) {
    auditorLines.push(
      "Gaps de ejecutabilidad:\n" + llmAuditor.executable_gaps.map((g) => `- ${g}`).join("\n"),
    );
  }

  return {
    gapsFeedback,
    tasksAuditorFeedback: auditorLines.join("\n\n"),
  };
}
