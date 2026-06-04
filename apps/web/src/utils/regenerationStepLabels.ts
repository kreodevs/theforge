import {
  MCP_DS_IMPORT_LABEL,
  WIREFRAME_DS_REFRESH_STEP_LABELS,
  WIREFRAME_PIPELINE_STEP_LABELS,
} from "@/constants/wireframe-progress-labels";
import type { ComponentSourceRegenerationStep } from "@/types/component-source-profiles";

function hasDsImportStep(
  progress: ComponentSourceRegenerationStep | null,
  stepsHistory: ComponentSourceRegenerationStep[],
): boolean {
  return (
    stepsHistory.some((s) => s.step === 1 && s.label === MCP_DS_IMPORT_LABEL) ||
    (progress?.step === 1 && progress.label === MCP_DS_IMPORT_LABEL)
  );
}

/** Resolve step label from SSE first; wireframe-aligned fallbacks; never MCP-mapping placeholders. */
export function resolveRegenerationStepLabel(
  stepNum: number,
  progress: ComponentSourceRegenerationStep | null,
  stepsHistory: ComponentSourceRegenerationStep[],
): string {
  const historyEntry = stepsHistory.find((s) => s.step === stepNum);
  if (historyEntry?.label) return historyEntry.label;
  if (progress?.step === stepNum && progress.label) return progress.label;

  const dsImport = hasDsImportStep(progress, stepsHistory);
  if (stepNum === 1 && dsImport) return MCP_DS_IMPORT_LABEL;

  const wireframeIdx = dsImport ? stepNum - 2 : stepNum - 1;
  if (wireframeIdx >= 0 && wireframeIdx < WIREFRAME_DS_REFRESH_STEP_LABELS.length) {
    return WIREFRAME_DS_REFRESH_STEP_LABELS[wireframeIdx]!;
  }
  if (wireframeIdx >= 0 && wireframeIdx < WIREFRAME_PIPELINE_STEP_LABELS.length) {
    return WIREFRAME_PIPELINE_STEP_LABELS[wireframeIdx]!;
  }

  return `Paso ${stepNum}`;
}

/** Prefer SSE totalSteps; avoid inventing extra steps from stale static fallbacks. */
export function resolveRegenerationTotalSteps(
  progress: ComponentSourceRegenerationStep | null,
  stepsHistory: ComponentSourceRegenerationStep[],
): number {
  if (progress?.totalSteps != null && progress.totalSteps > 0) return progress.totalSteps;
  const fromHistory = stepsHistory.reduce((max, s) => Math.max(max, s.totalSteps ?? 0), 0);
  if (fromHistory > 0) return fromHistory;
  return Math.max(stepsHistory.length, progress?.step ?? 1, 1);
}
