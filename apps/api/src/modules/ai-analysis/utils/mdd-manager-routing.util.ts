import type { MddQualityGateGap, MddQualityGateResult } from "@theforge/shared-types";
import type { AuditorGapsState } from "../state/mdd-state.schema.js";

const SECTION_AGENT_MAP: Array<{ pattern: RegExp; agent: string }> = [
  { pattern: /secci[oó]n\s*1|contexto|alcance|constituci|clarifier/i, agent: "clarifier" },
  {
    pattern: /secci[oó]n\s*(2|3|4)|modelo|sql|api|contrato|arquitectura|endpoint|tabla|mermaid|erdiagram|payload/i,
    agent: "software_architect",
  },
  { pattern: /secci[oó]n\s*6|seguridad|auth|mfa|rbac|totp|password/i, agent: "security" },
  { pattern: /secci[oó]n\s*7|infra|docker|despliegue|manifest|kubernetes|ci\/cd/i, agent: "integration" },
  { pattern: /secci[oó]n\s*5|l[oó]gica|edge\s*case/i, agent: "software_architect" },
];

function inferAgentsFromBlob(blob: string): string[] {
  const agents = new Set<string>();
  for (const { pattern, agent } of SECTION_AGENT_MAP) {
    if (pattern.test(blob)) agents.add(agent);
  }
  if (agents.size === 0) return ["software_architect"];
  return [...agents];
}

/**
 * Maps structured critical_gaps from the Auditor to graph agent node names.
 */
export function inferAgentsFromCriticalGaps(
  gaps: AuditorGapsState["critical_gaps"],
): string[] {
  const agents = new Set<string>();
  for (const g of gaps) {
    const blob = [...(g.sections ?? []), g.issue, g.fix].join(" ");
    for (const agent of inferAgentsFromBlob(blob)) agents.add(agent);
  }
  if (agents.size === 0) return ["software_architect"];
  return [...agents];
}

/** Maps Quality Gate gaps (lean) to graph agent node names. */
export function inferAgentsFromQualityGaps(gaps: MddQualityGateGap[]): string[] {
  const agents = new Set<string>();
  for (const g of gaps) {
    const blob = `${g.section} ${g.issue} ${g.fix}`;
    for (const agent of inferAgentsFromBlob(blob)) agents.add(agent);
  }
  if (agents.size === 0) return ["software_architect"];
  return [...agents];
}

/** Prefer structured gaps; fallback to free-text auditor feedback regex. */
export function resolveCorrectionAgents(
  auditorGaps: AuditorGapsState | null | undefined,
  auditorFeedback: string | undefined,
  inferFromFeedback: (feedback: string) => string[],
): string[] {
  const structured = auditorGaps?.critical_gaps ?? [];
  if (structured.length > 0) return inferAgentsFromCriticalGaps(structured);
  const fb = auditorFeedback?.trim();
  if (fb) return inferFromFeedback(fb);
  return ["software_architect"];
}

/** Routing desde Quality Gate lean: gaps → generadores; blockers → feedback inferido. */
export function resolveCorrectionAgentsFromQualityGate(
  qualityGate: MddQualityGateResult | null | undefined,
  inferFromFeedback?: (feedback: string) => string[],
): string[] {
  const gaps = qualityGate?.gaps ?? [];
  if (gaps.length > 0) return inferAgentsFromQualityGaps(gaps);
  const blockers = qualityGate?.blockers ?? [];
  if (blockers.length > 0 && inferFromFeedback) {
    return inferFromFeedback(blockers.join("\n"));
  }
  return ["software_architect"];
}

const CORRECTION_PIPELINE_AGENTS = ["software_architect", "security", "integration"] as const;
const CORRECTION_PIPELINE_TAIL = ["formatter", "diagram_injector", "quality_gate"] as const;

/**
 * Expande agentes de corrección a nodos concretos del grafo lean.
 * Solo incluye security/integration cuando los gaps lo exigen (evita ~6 min de re-ejecución).
 */
export function expandCorrectionSectionsToRun(agentNames: string[]): string[] {
  const valid = new Set(
    agentNames.filter((a) =>
      CORRECTION_PIPELINE_AGENTS.includes(a as (typeof CORRECTION_PIPELINE_AGENTS)[number]),
    ),
  );
  const out: string[] = [];
  for (const node of CORRECTION_PIPELINE_AGENTS) {
    if (valid.has(node)) out.push(node);
  }
  if (!out.length) return ["software_architect", ...CORRECTION_PIPELINE_TAIL];
  return [...out, ...CORRECTION_PIPELINE_TAIL];
}

export type QualityGateCorrectionState = {
  delegateTarget: "sections" | "clarifier_only";
  sectionsToRun?: string[];
  executorControlled?: boolean;
  previousMddDraftForMerge?: string;
  acceptedProposalDirective?: string;
};

/** Estado de routing para corrección acotada tras fallo del Quality Gate. */
export function buildQualityGateCorrectionState(
  qualityGate: MddQualityGateResult | null | undefined,
  inferFromFeedback?: (feedback: string) => string[],
  gapFeedback?: string,
): QualityGateCorrectionState {
  const agents = resolveCorrectionAgentsFromQualityGate(qualityGate, inferFromFeedback);
  const clarifierOnly = agents.length === 1 && agents[0] === "clarifier";
  if (clarifierOnly) {
    return { delegateTarget: "clarifier_only" };
  }
  return {
    delegateTarget: "sections",
    sectionsToRun: expandCorrectionSectionsToRun(agents),
    executorControlled: true,
    acceptedProposalDirective: gapFeedback,
  };
}
