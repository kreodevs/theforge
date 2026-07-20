import { ComplexityLevel } from "@theforge/database";
import type { DeliverableKind } from "@theforge/shared-types";
import type { TheForgeFileToModify } from "../theforge/theforge.service.js";
import type { McpUiDebugEntry } from "../theforge/mcp-ui-debug.context.js";
import type { LogicFlowsSection5CoverageReport } from "../ai/utils/legacy-as-is-logic-flows.util.js";
import type { LegacySectionMergeTrace } from "./legacy-section-merge.types.js";
import type {
  LegacyDeliverablesStrategyResolution,
} from "./legacy-deliverables-strategy/legacy-deliverables-strategy.types.js";

/** Respuesta de `generate-codebase-doc` cuando el API tiene trazas MCP (debug UI). */
export type GenerateCodebaseDocResponse = {
  codebaseDoc: string;
  mddContent?: string;
  mcpDebugTrace?: McpUiDebugEntry[];
};

export type LegacyIndexSddResolutionChoice = "trust_index" | "trust_sdd" | "proceed_with_warnings";

/** Paso de la cascada legacy de entregables (telemetría / depuración). */
export type LegacyDeliverablesDebugStepKind =
  | "preflight"
  | "preflight_plan"
  | "index_sdd_gate"
  | "theforge_context"
  | DeliverableKind;

export interface LegacyDeliverablesDebugStep {
  kind: LegacyDeliverablesDebugStepKind;
  /** ISO al finalizar el paso */
  at: string;
  durationMs: number;
  ok: boolean;
  /** Caracteres del campo persistido en `Project` tras el paso (si aplica). */
  outChars?: number;
  detail?: string;
  error?: string;
}

/** Trazabilidad de la última ejecución de `POST …/legacy/generate-deliverables`. */
export interface LegacyDeliverablesDebugReport {
  startedAt: string;
  finishedAt?: string;
  ok?: boolean;
  deliverablesWithBody?: number;
  mddSource: "mddContent" | "codebaseDoc_fallback" | "none";
  mddChars: number;
  codebaseDocChars: number;
  mddContentChars: number;
  theforgeContextChars: number;
  theforgeConfigured: boolean;
  complexityEffective: ComplexityLevel;
  deliverablesOrder: DeliverableKind[];
  steps: LegacyDeliverablesDebugStep[];
  fatalError?: { message: string; stack?: string };
  upstreamRateLimited?: boolean;
  retryAfterSeconds?: number;
  mddCharsSentToLlm?: number;
  mddClippedForLlm?: boolean;
  mddLlmStrategy?: "full" | "truncate" | "rollup";
  mddRollupWindows?: number;
  mddRollupFailed?: boolean;
  sectionMergeTraces?: LegacySectionMergeTrace[];
  strategyDecisions?: LegacyDeliverablesStrategyResolution[];
  pipelineMode?: LegacyDeliverablesPipelineMode;
  legacyBaselineStage?: boolean;
  logicFlowsSection5Coverage?: LogicFlowsSection5CoverageReport;
}

/** Modo de generación en cascada bulk — paridad con endpoints individuales. */
export type LegacyDeliverablesPipelineMode =
  | "projects_generate_document"
  | "generate_from_codebase"
  | "legacy_run_step_fallback";

export interface LegacyFlowState {
  description?: string;
  filesToModify?: TheForgeFileToModify[] | string[];
  questions?: string[];
  suggestedAnswers?: Record<string, string>;
  answers?: Record<string, string>;
  codebaseDoc?: string;
  legacyIndexSddResolution?: {
    choice: LegacyIndexSddResolutionChoice;
    resolvedAt: string;
  };
  lastDeliverablesDebug?: LegacyDeliverablesDebugReport;
}

/** Respuesta de `POST …/legacy/generate-mdd` (ligera por defecto). */
export type LegacyGenerateMddResponse = {
  ok: true;
  persisted: true;
  mddLength: number;
  wordCount: number;
  stageId?: string;
  deliveryGate: {
    ok: boolean;
    score: number;
    blockers: string[];
    warnings: string[];
  };
  mddContent?: string;
};
