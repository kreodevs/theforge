/**
 * Unified SDD analyze report (spec-kit `/speckit.analyze` equivalent).
 */

export interface ConformanceResult {
  ok: boolean;
  gaps: string[];
}

export interface ApiConformanceResult {
  ok: boolean;
  missingInApi: string[];
  extraInApi: string[];
}

export interface SddArtifactPresence {
  present: boolean;
  wordCount: number;
}

export interface SddSpecAnalyzeSlice {
  present: boolean;
  wordCount: number;
  clarificationMarkerCount: number;
  hasPendingClarificationSection: boolean;
}

export interface SddTasksAnalyzeSlice {
  present: boolean;
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  parallelizableOpen: number;
  checkpoints: string[];
}

export interface SddAgentGovernanceAnalyzeSlice {
  present: boolean;
  fileCount: number;
  missingRequiredPaths: string[];
  hasInstallGuide: boolean;
  /** True when all expected docs/sdd mirrors for present deliverables exist. */
  pathAlignmentOk: boolean;
  missingMirrorPaths?: string[];
  mddConformanceOk?: boolean;
  mddConformanceGaps?: string[];
}

export interface SddAnalyzeConformance {
  blueprint: ConformanceResult;
  blueprintDataModel: ConformanceResult;
  api: ApiConformanceResult;
  logicFlows: ConformanceResult;
  infra: ConformanceResult;
}

export type SddAnalyzeStatus = "ok" | "warnings" | "blocked";

/** Cascade doc/tasks accuracy (PLAN-CASCADE-90-ACCURACY). */
export interface SddAccuracyAnalyzeSlice {
  docScore: number;
  taskScore: number;
  docOk: boolean;
  taskOk: boolean;
  codegenReady: boolean;
  hardGateEnabled: boolean;
  hardGateBlocked: boolean;
  topGaps: string[];
}

export interface SddAnalyzeReport {
  generatedAt: string;
  projectId: string;
  projectName: string;
  featureDir: string;
  semaphore: "ROJO" | "AMARILLO" | "VERDE" | null;
  /** Exactitud documental / tasks vs BRD (umbral 90). */
  accuracy?: SddAccuracyAnalyzeSlice;
  artifacts: {
    mdd: SddArtifactPresence;
    spec: SddSpecAnalyzeSlice;
    blueprint: SddArtifactPresence;
    tasks: SddTasksAnalyzeSlice;
    apiContracts: SddArtifactPresence;
    logicFlows: SddArtifactPresence;
    infra: SddArtifactPresence;
    useCases: SddArtifactPresence;
    userStories: SddArtifactPresence;
    uxUiGuide: SddArtifactPresence;
    agentGovernance: SddAgentGovernanceAnalyzeSlice;
  };
  conformance: SddAnalyzeConformance;
  crossArtifactGaps: string[];
  /** Optional BRD ↔ MDD objective alignment (legacy F2). */
  brdHealth?: { ok: boolean; warnings: string[] };
  /** Phase0 → BRD → Spec traceability (greenfield). */
  phase0Bridge?: { ok: boolean; phase0Present: boolean; gapCount: number };
  summary: {
    status: SddAnalyzeStatus;
    score: number;
    headline: string;
  };
}
