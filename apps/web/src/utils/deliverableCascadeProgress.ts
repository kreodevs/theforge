import type { DeliverableWaveStep } from "../../../../packages/shared-types/src/deliverables-matrix.ts";
import { deliverableWaveStepLabel } from "../../../../packages/shared-types/src/deliverables-matrix.ts";
import type { AgentProgressItem } from "./agentProgress";

const IGNORED_CASCADE_PROGRESS_STEPS = new Set([
  "done",
  "preflight",
  "index_sdd_gate",
  "theforge_context",
]);

/** Maps API/BullMQ `progress.step` (kind slug or legacy label) to Workshop checklist label. */
export function resolveDeliverableCascadeStepLabel(apiStep: string): string | null {
  const step = apiStep.trim();
  if (!step || IGNORED_CASCADE_PROGRESS_STEPS.has(step)) return null;
  if (step === "ui_screens_sync") return deliverableWaveStepLabel("ui_screens_sync");
  const fromKind = deliverableWaveStepLabel(step as DeliverableWaveStep);
  if (typeof fromKind === "string" && fromKind.length > 0) return fromKind;
  return step;
}

export type DeliverableCascadeProgressPayload = {
  step?: string;
  /** Acumulado de pasos terminados (evita perder eventos entre polls en oleadas paralelas). */
  completedSteps?: string[];
  index?: number;
  total?: number;
  phase?: string;
};

/** Pasos completados en el payload de progreso (cola / SSE). */
export function readDeliverableCascadeCompletedSteps(progress: unknown): string[] {
  if (!progress || typeof progress !== "object") return [];
  const payload = progress as DeliverableCascadeProgressPayload;
  if (Array.isArray(payload.completedSteps) && payload.completedSteps.length > 0) {
    return payload.completedSteps.filter((s): s is string => typeof s === "string" && s.length > 0);
  }
  const step = readDeliverableCascadeProgressStep(progress);
  return step && step !== "done" ? [step] : [];
}

/** Normalizes queue job progress (object or missing) into a step string. */
export function readDeliverableCascadeProgressStep(
  progress: unknown,
): string | null {
  if (!progress || typeof progress !== "object") return null;
  const step = (progress as DeliverableCascadeProgressPayload).step;
  return typeof step === "string" ? step : null;
}

/**
 * Marks one checklist row as done when a deliverable step completes.
 * Only increments the completed count when a matching row exists.
 */
export function applyDeliverableCascadeStepDone(
  agentProgress: readonly AgentProgressItem[],
  completedLabels: Set<string>,
  apiStep: string,
): { agentProgress: AgentProgressItem[]; cascadeCompleted: number; matched: boolean } {
  const label = resolveDeliverableCascadeStepLabel(apiStep);
  if (!label) {
    return { agentProgress: [...agentProgress], cascadeCompleted: completedLabels.size, matched: false };
  }
  const row = agentProgress.find((item) => item.step === label);
  if (!row) {
    return { agentProgress: [...agentProgress], cascadeCompleted: completedLabels.size, matched: false };
  }
  if (completedLabels.has(label)) {
    return { agentProgress: [...agentProgress], cascadeCompleted: completedLabels.size, matched: true };
  }
  completedLabels.add(label);
  const next = agentProgress.map((item) =>
    item.step === label
      ? { ...item, message: `✅ ${label} — Terminado`, status: "terminado" as const }
      : item,
  );
  return { agentProgress: next, cascadeCompleted: completedLabels.size, matched: true };
}

/**
 * Aplica todos los pasos completados del job (no solo el último `step`).
 * En greenfield oleada 3+ varios entregables terminan entre dos polls de 1,2s.
 */
export function applyDeliverableCascadeProgressUpdate(
  agentProgress: readonly AgentProgressItem[],
  completedLabels: Set<string>,
  progress: unknown,
): { agentProgress: AgentProgressItem[]; cascadeCompleted: number; matched: boolean } {
  const steps = readDeliverableCascadeCompletedSteps(progress);
  if (steps.length === 0) {
    return { agentProgress: [...agentProgress], cascadeCompleted: completedLabels.size, matched: false };
  }
  let rows = [...agentProgress];
  let matched = false;
  for (const apiStep of steps) {
    const result = applyDeliverableCascadeStepDone(rows, completedLabels, apiStep);
    rows = result.agentProgress;
    if (result.matched) matched = true;
  }
  const latest = readDeliverableCascadeProgressStep(progress);
  if (latest && latest !== "done" && !completedLabels.has(resolveDeliverableCascadeStepLabel(latest) ?? "")) {
    rows = applyDeliverableCascadeStepActive(rows, latest, completedLabels);
  }
  return { agentProgress: rows, cascadeCompleted: completedLabels.size, matched };
}

/** Highlights the step currently running (legacy queue reports label after each wave). */
export function applyDeliverableCascadeStepActive(
  agentProgress: readonly AgentProgressItem[],
  apiStep: string,
  completedLabels: ReadonlySet<string>,
): AgentProgressItem[] {
  const label = resolveDeliverableCascadeStepLabel(apiStep);
  if (!label || completedLabels.has(label)) return [...agentProgress];
  return agentProgress.map((item) =>
    item.step === label
      ? { ...item, message: `⚡ ${label} — Generando…`, status: "generando" as const }
      : item,
  );
}
