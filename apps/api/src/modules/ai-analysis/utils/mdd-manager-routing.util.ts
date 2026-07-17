import type { MddQualityGateGap, MddQualityGateResult } from "@theforge/shared-types";
import type { AuditorGapsState } from "../state/mdd-state.schema.js";
import { draftHasSubstantialArchitectSections } from "./mdd-delivery-gate-loop.util.js";

const INTEGRATION_GAP_RE =
  /§\s*7\b|secci[oó]n\s*7|manifest|hashing_algorithm|infra(estructura)?|docker|despliegue|kubernetes|ci\/cd|jwks|api_prefix|node:|microservicios|tabla\s+outbox\b/i;
const SECURITY_GAP_RE =
  /§\s*6\b|secci[oó]n\s*6|seguridad|auth|mfa|rbac|totp|argon2(?:id)?|bcrypt|password_hash|ldap/i;
const ARCHITECT_GAP_RE =
  /§\s*[2345]\b|secci[oó]n\s*[2345]|modelo\s+de\s+datos|create\s+table|technicalmetadata|erdiagram|contrato\s+api|l[oó]gica|edge\s*case/i;
const CLARIFIER_GAP_RE = /§\s*1\b|secci[oó]n\s*1|contexto|alcance|constituci/i;
/** Mensajes de `detectUnclosedSqlFences` y variantes delivery gate (fix determinista vía formatter). */
const SQL_FENCE_BLOCKER_RE = /```sql sin cerrar|bloque ```sql sin cerrar|unclosed.*```sql/i;

function isSqlFenceBlockerText(text: string): boolean {
  return SQL_FENCE_BLOCKER_RE.test(text);
}

function isSqlFenceBlockerGap(gap: MddQualityGateGap): boolean {
  return isSqlFenceBlockerText(gapBlob(gap));
}

/** Agente primario desde el campo `section` del gap (evita falsos positivos por "endpoint" en fixes de §6). */
export function inferPrimaryAgentFromGapSection(section: string): string | null {
  const s = (section ?? "").trim();
  if (!s || /^general$/i.test(s)) return null;
  if (/secci[oó]n\s*1|§\s*1\b|contexto|alcance/i.test(s)) return "clarifier";
  if (/secci[oó]n\s*6|§\s*6\b|seguridad/i.test(s)) return "security";
  if (/secci[oó]n\s*7|§\s*7\b|manifest|infra(estructura)?|despliegue/i.test(s)) return "integration";
  if (/secci[oó]n\s*5|§\s*5\b|l[oó]gica|edge\s*case/i.test(s)) return "software_architect";
  if (/secci[oó]n\s*(2|3|4)|§\s*(2|3|4)\b|arquitectura|modelo|contrato/i.test(s)) {
    return "software_architect";
  }
  return null;
}

function inferSectionLabelFromText(text: string): string {
  const t = text.trim();
  if (/§\s*7|manifest/i.test(t)) return "Sección 7";
  if (/§\s*6/i.test(t)) return "Sección 6";
  if (/§\s*5|l[oó]gica|edge\s*case/i.test(t)) return "Sección 5";
  const secMatch = t.match(/§\s*([1-7])|secci[oó]n\s*([1-7])/i);
  if (secMatch) return `Sección ${secMatch[1] ?? secMatch[2]}`;
  if (/§\s*1|contexto|alcance/i.test(t)) return "Sección 1";
  return "General";
}

/** Convierte un blocker determinista en gap enrutable (misma forma que gaps LLM). */
export function blockerToRoutableGap(blocker: string): MddQualityGateGap {
  const trimmed = blocker.trim();
  return {
    section: isSqlFenceBlockerText(trimmed) ? "Sección 3" : inferSectionLabelFromText(trimmed),
    issue: trimmed,
    fix: trimmed,
  };
}

function dedupeRoutableGaps(gaps: MddQualityGateGap[]): MddQualityGateGap[] {
  const seen = new Set<string>();
  const out: MddQualityGateGap[] = [];
  for (const gap of gaps) {
    const key = `${gap.section}::${gap.issue.slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(gap);
  }
  return out;
}

/** Une gaps estructurados + blockers deterministas antes de inferir agentes. */
export function collectQualityGateRoutableGaps(
  qualityGate: MddQualityGateResult | null | undefined,
): MddQualityGateGap[] {
  const fromGaps = qualityGate?.gaps ?? [];
  const fromBlockers = (qualityGate?.blockers ?? []).map(blockerToRoutableGap);
  return dedupeRoutableGaps([...fromGaps, ...fromBlockers]);
}

function gapBlob(gap: MddQualityGateGap): string {
  return `${gap.section} ${gap.issue} ${gap.fix}`;
}

function gapExplicitlyTargetsArchitect(gap: MddQualityGateGap): boolean {
  if (isSqlFenceBlockerGap(gap)) return false;
  const primary = inferPrimaryAgentFromGapSection(gap.section);
  if (primary === "software_architect") return true;
  if (primary === "security" || primary === "integration" || primary === "clarifier") return false;
  const blob = gapBlob(gap);
  return ARCHITECT_GAP_RE.test(blob) && !INTEGRATION_GAP_RE.test(blob) && !SECURITY_GAP_RE.test(blob);
}

function gapExplicitlyTargetsClarifier(gap: MddQualityGateGap): boolean {
  const primary = inferPrimaryAgentFromGapSection(gap.section);
  if (primary === "clarifier") return true;
  if (primary) return false;
  return CLARIFIER_GAP_RE.test(gapBlob(gap)) && !ARCHITECT_GAP_RE.test(gapBlob(gap));
}

function gapTargetsSecInt(gap: MddQualityGateGap): boolean {
  const agents = inferAgentsFromQualityGap(gap);
  return agents.every((a) => a === "security" || a === "integration");
}

function inferAgentsFromBlob(blob: string): string[] {
  if (isSqlFenceBlockerText(blob)) return ["formatter"];
  const agents = new Set<string>();
  if (CLARIFIER_GAP_RE.test(blob)) agents.add("clarifier");
  if (ARCHITECT_GAP_RE.test(blob)) agents.add("software_architect");
  if (SECURITY_GAP_RE.test(blob)) agents.add("security");
  if (INTEGRATION_GAP_RE.test(blob)) agents.add("integration");

  if (/manifest|hashing_algorithm/i.test(blob)) {
    agents.add("integration");
    agents.delete("software_architect");
  }

  if (agents.size === 0) {
    if (INTEGRATION_GAP_RE.test(blob)) return ["integration"];
    if (SECURITY_GAP_RE.test(blob)) return ["security"];
    if (CLARIFIER_GAP_RE.test(blob)) return ["clarifier"];
    return ["integration"];
  }
  return [...agents];
}

/** Infiere uno o más agentes para un gap (manifest+bcrypt puede requerir security+integration). */
export function inferAgentsFromQualityGap(gap: MddQualityGateGap): string[] {
  if (isSqlFenceBlockerGap(gap)) return ["formatter"];
  const primary = inferPrimaryAgentFromGapSection(gap.section);
  const blob = gapBlob(gap);

  if (primary === "security" || primary === "integration" || primary === "clarifier") {
    const agents = new Set<string>([primary]);
    if (primary === "integration" && /argon2|bcrypt|§\s*6|seguridad/i.test(blob)) {
      agents.add("security");
    }
    if (primary === "security" && /manifest|hashing_algorithm|§\s*7/i.test(blob)) {
      agents.add("integration");
    }
    return sortCorrectionAgents([...agents]);
  }

  if (primary === "software_architect") return ["software_architect"];

  const fromBlob = inferAgentsFromBlob(blob);
  if (/manifest|hashing_algorithm/i.test(blob) && !ARCHITECT_GAP_RE.test(blob)) {
    return sortCorrectionAgents(
      fromBlob.filter((a) => a !== "software_architect" && a !== "clarifier"),
    );
  }
  return sortCorrectionAgents(fromBlob);
}

const CORRECTION_AGENT_ORDER = [
  "software_architect",
  "security",
  "integration",
  "formatter",
  "clarifier",
] as const;

function sortCorrectionAgents(agents: string[]): string[] {
  const set = new Set(agents);
  return CORRECTION_AGENT_ORDER.filter((a) => set.has(a));
}
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
    for (const agent of inferAgentsFromQualityGap(g)) agents.add(agent);
  }
  const sorted = sortCorrectionAgents([...agents]);
  if (sorted.length === 0) return ["software_architect"];
  return sorted;
}

/** True cuando todos los gaps apuntan solo a §6/§7 (security/integration). */
export function qualityGapsTargetOnlySecInt(gaps: MddQualityGateGap[]): boolean {
  if (!gaps.length) return false;
  return gaps.every((g) => gapTargetsSecInt(g));
}

/** True cuando los gaps son exclusivamente §5 (paso dedicado, no regenerar §2–§4). */
export function qualityGapsTargetOnlySection5(gaps: MddQualityGateGap[]): boolean {
  if (!gaps.length) return false;
  return gaps.every(
    (g) =>
      inferPrimaryAgentFromGapSection(g.section) === "software_architect" &&
      /5|l[oó]gica/i.test(g.section),
  );
}

export type CorrectionRoutingMeta = {
  agents: string[];
  sectionsToRun: string[];
  architectSkipped: boolean;
  section5OnlyPass: boolean;
};

export type CorrectionRoutingOptions = {
  mddDraft?: string;
};

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

function filterCorrectionAgents(
  agents: string[],
  routableGaps: MddQualityGateGap[],
  options?: CorrectionRoutingOptions,
): { agents: string[]; architectSkipped: boolean } {
  let filtered = [...agents];
  let architectSkipped = false;
  const hadArchitect = filtered.includes("software_architect");

  const clarifierExplicit = routableGaps.some((g) => gapExplicitlyTargetsClarifier(g));
  if (!clarifierExplicit) {
    filtered = filtered.filter((a) => a !== "clarifier");
  } else if (filtered.filter((a) => a !== "clarifier").length > 0) {
    filtered = filtered.filter((a) => a !== "clarifier");
  }

  const architectExplicit = routableGaps.some((g) => gapExplicitlyTargetsArchitect(g));
  const secIntOnly = routableGaps.length > 0 && qualityGapsTargetOnlySecInt(routableGaps);
  const mixedWithSubstantialArchitect =
    routableGaps.some((g) => gapExplicitlyTargetsArchitect(g)) &&
    routableGaps.some((g) => gapTargetsSecInt(g)) &&
    draftHasSubstantialArchitectSections(options?.mddDraft ?? "");

  if (hadArchitect && (secIntOnly || mixedWithSubstantialArchitect || !architectExplicit)) {
    filtered = filtered.filter((a) => a !== "software_architect");
    architectSkipped = true;
  }

  if (filtered.length === 0) {
    if (routableGaps.some((g) => isSqlFenceBlockerGap(g))) {
      filtered = ["formatter"];
    } else if (secIntOnly || routableGaps.some((g) => gapTargetsSecInt(g))) {
      filtered = sortCorrectionAgents(
        inferAgentsFromQualityGaps(routableGaps).filter(
          (a) => a === "security" || a === "integration",
        ),
      );
    } else if (clarifierExplicit) {
      filtered = ["clarifier"];
    } else {
      filtered = ["integration"];
    }
  }

  return { agents: sortCorrectionAgents(filtered), architectSkipped };
}

/** Routing desde Quality Gate lean: gaps + blockers → generadores. */
export function resolveCorrectionAgentsFromQualityGate(
  qualityGate: MddQualityGateResult | null | undefined,
  inferFromFeedback?: (feedback: string) => string[],
  options?: CorrectionRoutingOptions,
): string[] {
  return resolveCorrectionRouting(qualityGate, inferFromFeedback, options).agents;
}

const CORRECTION_PIPELINE_AGENTS = ["software_architect", "security", "integration"] as const;
const CORRECTION_PIPELINE_TAIL = ["formatter", "diagram_injector", "quality_gate"] as const;
const CORRECTION_SEC_INT_FANOUT_TAIL = ["format_sec_int", "diagram_injector", "quality_gate"] as const;
const CORRECTION_FORMATTER_ONLY_PIPELINE = ["formatter", "diagram_injector", "quality_gate"] as const;

/**
 * Expande agentes de corrección a nodos concretos del grafo lean.
 * security+integration en paralelo vía fanout_sec_int cuando no hay architect previo.
 */
export function expandCorrectionSectionsToRun(agentNames: string[]): string[] {
  const wantsFormatter = agentNames.includes("formatter");
  const valid = new Set(
    agentNames.filter((a) =>
      CORRECTION_PIPELINE_AGENTS.includes(a as (typeof CORRECTION_PIPELINE_AGENTS)[number]),
    ),
  );
  const hasSecurity = valid.has("security");
  const hasIntegration = valid.has("integration");
  const hasArchitect = valid.has("software_architect");

  if (!valid.size) {
    if (wantsFormatter) return [...CORRECTION_FORMATTER_ONLY_PIPELINE];
    return ["software_architect", ...CORRECTION_PIPELINE_TAIL];
  }

  if (!hasArchitect && hasSecurity && hasIntegration) {
    return [
      ...(wantsFormatter ? (["formatter"] as const) : []),
      "fanout_sec_int",
      ...CORRECTION_SEC_INT_FANOUT_TAIL,
    ];
  }

  const out: string[] = [];
  for (const node of CORRECTION_PIPELINE_AGENTS) {
    if (valid.has(node)) out.push(node);
  }

  if (!hasArchitect && (hasSecurity || hasIntegration)) {
    return [
      ...(wantsFormatter ? (["formatter"] as const) : []),
      ...out,
      ...CORRECTION_SEC_INT_FANOUT_TAIL,
    ];
  }

  return [...out, ...CORRECTION_PIPELINE_TAIL];
}

export type QualityGateCorrectionState = {
  delegateTarget: "sections" | "clarifier_only";
  sectionsToRun?: string[];
  executorControlled?: boolean;
  previousMddDraftForMerge?: string;
  acceptedProposalDirective?: string;
  architectSection5PassPending?: boolean;
  correctionArchitectSkipped?: boolean;
};

/** Resuelve agentes + cadena de nodos para corrección QG (sin re-ejecutar architect si solo §6/§7). */
export function resolveCorrectionRouting(
  qualityGate: MddQualityGateResult | null | undefined,
  inferFromFeedback?: (feedback: string) => string[],
  options?: CorrectionRoutingOptions,
): CorrectionRoutingMeta {
  const routableGaps = collectQualityGateRoutableGaps(qualityGate);
  let agents: string[];
  let architectSkipped = false;

  if (routableGaps.length > 0) {
    const raw = inferAgentsFromQualityGaps(routableGaps);
    ({ agents, architectSkipped } = filterCorrectionAgents(raw, routableGaps, options));
  } else {
    const blockers = qualityGate?.blockers ?? [];
    if (blockers.length > 0 && inferFromFeedback) {
      const raw = inferFromFeedback(blockers.join("\n"));
      const blockerGaps = blockers.map(blockerToRoutableGap);
      ({ agents, architectSkipped } = filterCorrectionAgents(raw, blockerGaps, options));
    } else {
      agents = ["software_architect"];
    }
  }

  const section5OnlyPass =
    agents.length === 1 &&
    agents[0] === "software_architect" &&
    qualityGapsTargetOnlySection5(routableGaps.length ? routableGaps : (qualityGate?.gaps ?? []));
  if (!agents.includes("software_architect") && routableGaps.length > 0) {
    architectSkipped = true;
  }
  const sectionsToRun = expandCorrectionSectionsToRun(agents);
  return { agents, sectionsToRun, architectSkipped, section5OnlyPass };
}

/** Estado de routing para corrección acotada tras fallo del Quality Gate. */
export function buildQualityGateCorrectionState(
  qualityGate: MddQualityGateResult | null | undefined,
  inferFromFeedback?: (feedback: string) => string[],
  gapFeedback?: string,
  options?: CorrectionRoutingOptions,
): QualityGateCorrectionState {
  const routing = resolveCorrectionRouting(qualityGate, inferFromFeedback, options);
  const clarifierOnly = routing.agents.length === 1 && routing.agents[0] === "clarifier";
  if (clarifierOnly) {
    return { delegateTarget: "clarifier_only" };
  }
  return {
    delegateTarget: "sections",
    sectionsToRun: routing.sectionsToRun,
    executorControlled: true,
    acceptedProposalDirective: gapFeedback,
    ...(routing.section5OnlyPass ? { architectSection5PassPending: true } : {}),
    ...(routing.architectSkipped ? { correctionArchitectSkipped: true } : {}),
  };
}
