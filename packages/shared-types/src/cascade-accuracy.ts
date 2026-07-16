/**
 * Cascade documentation / tasks accuracy scores (plan PLAN-CASCADE-90-ACCURACY).
 */

export interface AccuracyComponentScore {
  id: string;
  weight: number;
  /** 0–100 within component */
  score: number;
  gaps: string[];
}

export interface DocAccuracyResult {
  score: number;
  ok: boolean;
  components: AccuracyComponentScore[];
  blockers: string[];
}

export interface TaskAccuracyResult {
  score: number;
  ok: boolean;
  components: AccuracyComponentScore[];
  blockers: string[];
}

export interface CascadeAccuracyReport {
  doc: DocAccuracyResult;
  tasks: TaskAccuracyResult;
  /** Both ≥90 and no blockers */
  codegenReady: boolean;
  /** Env REQUIRE_DOC_ACCURACY_90 === "true" */
  hardGateEnabled: boolean;
  hardGateBlocked: boolean;
}

export const CASCADE_ACCURACY_THRESHOLD = 90;

/** Pre-flight Tasks: por debajo de este score no se genera (salvo `acknowledgeGaps` ≥ 50). */
export const TASKS_PREFLIGHT_DOC_ACCURACY_BLOCK_THRESHOLD = 70;
