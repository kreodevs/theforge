import { createHash } from "node:crypto";
import type { AffectedArtifact, DocumentationGapEvidence } from "@theforge/shared-types";
import {
  AGENT_GOVERNANCE_TEMPLATE_VERSION,
  parseAgentGovernanceScaffold,
  type AgentGovernanceFile,
  type AgentGovernanceScaffold,
} from "@theforge/shared-types";
import { serializeAgentGovernanceScaffold } from "../ai/utils/agent-governance.util.js";
import { resolveSddConflictGapMapping } from "./sdd-conflict-gap.util.js";

export const ADR_DECISIONS_PREFIX = "docs/sdd/decisions/";

export type ArchitectureDecisionSource =
  | "auto-deterministic"
  | "auto-reconcile"
  | "hitl-approved";

export interface ArchitectureDecisionInput {
  title: string;
  context: string;
  decision: string;
  consequences: string;
  affectedArtifacts: AffectedArtifact[];
  sddReference: string;
  source: ArchitectureDecisionSource;
  dedupKey: string;
  dateIso?: string;
}

export interface ArchitectureDecisionRecord extends ArchitectureDecisionInput {
  id: string;
  slug: string;
  path: string;
  content: string;
  graphPayload: {
    title: string;
    context: string;
    consequence: string;
    status: "Accepted";
  };
}

const MDD_WINS_RULE =
  "El MDD es la fuente de verdad (regla MDD wins): los entregables contradictorios se alinean con lo declarado en el MDD.";

const SOURCE_LABEL: Record<ArchitectureDecisionSource, string> = {
  "auto-deterministic": "reconciliación automática determinista SDD",
  "auto-reconcile": "reconciliación automática SDD (regeneración parcial)",
  "hitl-approved": "aprobación HITL de gap de documentación",
};

function slugifyAdr(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function formatAdrDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso.slice(0, 10);
  return `${d}/${m}/${y}`;
}

type MessagingAuthority = "bull" | "rabbitmq" | "kafka";

/** Resuelve broker autoritativo desde el mensaje de conflicto (no substrings en negación). */
function resolveMessagingAuthorityFromConflict(conflict: string): MessagingAuthority | null {
  if (/prioriza\s+BullMQ/i.test(conflict)) return "bull";
  if (/prioriza\s+RabbitMQ/i.test(conflict)) return "rabbitmq";
  if (/Kafka\s+vs\s+RabbitMQ/i.test(conflict)) return "kafka";
  return null;
}

function inferDecisionFromConflict(conflict: string): string {
  if (/TypeORM vs Prisma/i.test(conflict)) {
    return `${MDD_WINS_RULE} Se mantiene el ORM declarado en MDD §2/Blueprint y se eliminan referencias contradictorias en tasks, blueprint y demás entregables.`;
  }
  const messaging = resolveMessagingAuthorityFromConflict(conflict);
  if (messaging === "bull") {
    return `${MDD_WINS_RULE} Se adopta el broker/cola declarado en MDD §2 (BullMQ + Redis) y se sustituyen menciones sueltas de RabbitMQ/Kafka en entregables secundarios.`;
  }
  if (messaging === "rabbitmq") {
    return `${MDD_WINS_RULE} Se adopta RabbitMQ como broker declarado en MDD §2 y se eliminan menciones de BullMQ/Bull en tasks, user stories e infra.`;
  }
  if (messaging === "kafka") {
    return `${MDD_WINS_RULE} Se adopta el broker de mensajería declarado en MDD §2 y se alinean tasks/user stories con esa decisión.`;
  }
  if (/JWT:/i.test(conflict) || /JWT_SECRET|RS256/i.test(conflict)) {
    return `${MDD_WINS_RULE} Se prioriza el esquema JWT del MDD §6 (RS256 con par de claves PEM); JWT_SECRET (HS256) queda deprecado en entregables.`;
  }
  if (/Hashing bootstrap|Argon2|bcrypt/i.test(conflict)) {
    return `${MDD_WINS_RULE} Se aplica el algoritmo de hashing bootstrap documentado en MDD §6 en tasks e infra.`;
  }
  if (/Frontend:|React Hook Form|post-MVP/i.test(conflict)) {
    return `${MDD_WINS_RULE} El MVP se limita a API + CLI; menciones de UI web/React quedan marcadas como post-MVP en blueprint y guía UX/UI.`;
  }
  if (/MySQL vs PostgreSQL/i.test(conflict)) {
    return `${MDD_WINS_RULE} Se mantiene el motor de base de datos declarado en MDD §3 y se alinean tasks con esa decisión.`;
  }
  return `${MDD_WINS_RULE} Se corrigen las inconsistencias detectadas entre entregables SDD siguiendo la constitución (MDD).`;
}

function inferTitleFromConflict(conflict: string): string {
  if (/TypeORM vs Prisma/i.test(conflict)) return "ORM autoritativo según MDD";
  const messaging = resolveMessagingAuthorityFromConflict(conflict);
  if (messaging === "bull") return "Cola BullMQ + Redis según MDD";
  if (messaging === "rabbitmq") return "Broker RabbitMQ según MDD";
  if (messaging === "kafka") return "Broker de mensajería según MDD";
  if (/JWT:/i.test(conflict) || /JWT_SECRET|RS256/i.test(conflict)) {
    return "Autenticación JWT RS256 según MDD";
  }
  if (/Hashing bootstrap|Argon2|bcrypt/i.test(conflict)) {
    return "Hashing bootstrap según MDD §6";
  }
  if (/Frontend:|React Hook Form|post-MVP/i.test(conflict)) {
    return "Alcance MVP sin UI web (post-MVP calificado)";
  }
  if (/MySQL vs PostgreSQL/i.test(conflict)) {
    return "Motor de base de datos según MDD";
  }
  const trimmed = conflict.trim().slice(0, 72);
  return trimmed.length > 0 ? trimmed : "Resolución de conflicto SDD interno";
}

function buildConsequences(
  affectedArtifacts: AffectedArtifact[],
  source: ArchitectureDecisionSource,
): string {
  const artifacts =
    affectedArtifacts.length > 0
      ? affectedArtifacts.join(", ")
      : "mdd, tasks";
  const lines = [
    `- Artefactos alineados o regenerados: ${artifacts}.`,
    `- Origen de cierre: ${SOURCE_LABEL[source]}.`,
    "- La constitución (MDD) prevalece sobre menciones contradictorias en entregables derivados.",
  ];
  if (source === "auto-deterministic") {
    lines.push("- Corrección aplicada sin intervención humana (parche determinista en persistencia).");
  } else if (source === "hitl-approved") {
    lines.push("- Un revisor humano aprobó el gap antes de la regeneración parcial.");
  }
  return lines.join("\n");
}

function buildAdrMarkdown(input: ArchitectureDecisionInput, id: string): string {
  const dateIso = input.dateIso ?? new Date().toISOString();
  const dedupComment = `<!-- adr-dedup:${input.dedupKey} -->`;
  return [
    `# ${id}: ${input.title}`,
    "",
    `**Fecha:** ${formatAdrDate(dateIso)}  `,
    "**Estado:** Aceptada  ",
    `**Origen:** ${SOURCE_LABEL[input.source]}`,
    "",
    "## Contexto",
    "",
    input.context.trim(),
    "",
    "## Decisión",
    "",
    input.decision.trim(),
    "",
    "## Consecuencias",
    "",
    input.consequences.trim(),
    "",
    "## Artefactos afectados",
    "",
    input.affectedArtifacts.length > 0
      ? input.affectedArtifacts.map((a) => `- ${a}`).join("\n")
      : "- mdd\n- tasks",
    "",
    "## Referencia SDD",
    "",
    input.sddReference.trim(),
    "",
    dedupComment,
    "",
  ].join("\n");
}

export function computeArchitectureDecisionDedupKey(parts: string[]): string {
  const normalized = parts.map((p) => p.trim().toLowerCase()).filter(Boolean).join("|");
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
}

export function buildArchitectureDecisionFromSddConflict(
  conflict: string,
  source: ArchitectureDecisionSource,
  options?: { existingFiles?: AgentGovernanceFile[]; dateIso?: string },
): ArchitectureDecisionRecord {
  const mapping = resolveSddConflictGapMapping(conflict);
  const title = inferTitleFromConflict(conflict);
  const dedupKey = computeArchitectureDecisionDedupKey([source, conflict]);
  const input: ArchitectureDecisionInput = {
    title,
    context: conflict.trim(),
    decision: inferDecisionFromConflict(conflict),
    consequences: buildConsequences(mapping.affectedArtifacts, source),
    affectedArtifacts: mapping.affectedArtifacts,
    sddReference: mapping.reference,
    source,
    dedupKey,
    dateIso: options?.dateIso,
  };
  return finalizeArchitectureDecisionRecord(input, options?.existingFiles ?? []);
}

export function buildArchitectureDecisionFromGap(
  gap: {
    description: string;
    affectedArtifacts: AffectedArtifact[];
    evidence: DocumentationGapEvidence;
  },
  source: ArchitectureDecisionSource,
  options?: { existingFiles?: AgentGovernanceFile[]; dateIso?: string },
): ArchitectureDecisionRecord {
  const desc = gap.description.trim();
  const title =
    desc.length <= 80 ? desc : `${desc.slice(0, 77)}…`;
  const dedupKey = computeArchitectureDecisionDedupKey([
    source,
    gap.evidence.reference,
    desc,
  ]);
  const input: ArchitectureDecisionInput = {
    title,
    context: [
      desc,
      gap.evidence.snippet?.trim()
        ? `\n\n**Evidencia:**\n\n${gap.evidence.snippet.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join(""),
    decision: `${MDD_WINS_RULE} Tras la aprobación del gap, los artefactos afectados se regeneraron para reflejar la constitución (MDD) y eliminar la inconsistencia reportada.`,
    consequences: buildConsequences(gap.affectedArtifacts, source),
    affectedArtifacts: gap.affectedArtifacts,
    sddReference: gap.evidence.reference,
    source,
    dedupKey,
    dateIso: options?.dateIso,
  };
  return finalizeArchitectureDecisionRecord(input, options?.existingFiles ?? []);
}

function nextAdrNumber(files: AgentGovernanceFile[]): number {
  let max = 0;
  for (const file of files) {
    const match = file.path.match(/docs\/sdd\/decisions\/ADR-(\d+)-/i);
    if (match) max = Math.max(max, Number.parseInt(match[1]!, 10));
  }
  return max + 1;
}

function finalizeArchitectureDecisionRecord(
  input: ArchitectureDecisionInput,
  existingFiles: AgentGovernanceFile[],
): ArchitectureDecisionRecord {
  const num = nextAdrNumber(existingFiles);
  const id = `ADR-${String(num).padStart(3, "0")}`;
  const slug = slugifyAdr(input.title) || "decision";
  const path = `${ADR_DECISIONS_PREFIX}${id}-${slug}.md`;
  const content = buildAdrMarkdown(input, id);
  return {
    ...input,
    id,
    slug,
    path,
    content,
    graphPayload: {
      title: `${id}: ${input.title}`,
      context: input.context.slice(0, 2000),
      consequence: [input.decision, input.consequences].join("\n\n").slice(0, 2000),
      status: "Accepted",
    },
  };
}

export function listArchitectureDecisionFiles(
  agentGovernanceContent: string | null | undefined,
): AgentGovernanceFile[] {
  const scaffold = parseAgentGovernanceScaffold(agentGovernanceContent);
  if (!scaffold) return [];
  return scaffold.files.filter((f) => f.path.startsWith(ADR_DECISIONS_PREFIX));
}

function ensureScaffoldForAdrs(
  agentGovernanceContent: string | null | undefined,
): AgentGovernanceScaffold {
  const parsed = parseAgentGovernanceScaffold(agentGovernanceContent);
  if (parsed) return parsed;
  return {
    manifest: {
      templateVersion: AGENT_GOVERNANCE_TEMPLATE_VERSION,
      files: [],
      generatedAt: new Date().toISOString(),
    },
    files: [],
  };
}

function adrDedupKeyFromContent(content: string): string | null {
  const match = content.match(/<!-- adr-dedup:([a-f0-9]+) -->/);
  return match?.[1] ?? null;
}

/** Evita duplicar el mismo ADR (misma clave de deduplicación). */
export function architectureDecisionAlreadyRecorded(
  existingFiles: AgentGovernanceFile[],
  dedupKey: string,
): boolean {
  return existingFiles.some((f) => adrDedupKeyFromContent(f.content) === dedupKey);
}

export function appendArchitectureDecisionToScaffold(
  agentGovernanceContent: string | null | undefined,
  record: ArchitectureDecisionRecord,
): { serialized: string; appended: boolean } {
  const scaffold = ensureScaffoldForAdrs(agentGovernanceContent);
  const existingAdrs = listArchitectureDecisionFiles(
    serializeAgentGovernanceScaffold(scaffold),
  );
  if (architectureDecisionAlreadyRecorded(existingAdrs, record.dedupKey)) {
    return { serialized: serializeAgentGovernanceScaffold(scaffold), appended: false };
  }

  const paths = new Set(scaffold.manifest.files);
  paths.add(record.path);
  const updatedFiles = [
    ...scaffold.files.filter((f) => f.path !== record.path),
    { path: record.path, content: record.content },
  ];
  const updated: AgentGovernanceScaffold = {
    manifest: {
      ...scaffold.manifest,
      files: [...paths].sort((a, b) => a.localeCompare(b)),
    },
    files: updatedFiles,
  };
  return { serialized: serializeAgentGovernanceScaffold(updated), appended: true };
}

export function splitAutoReconcileConflictDescription(description: string): string[] {
  return description
    .split(" | ")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isAutoReconcileInternalGap(evidence: DocumentationGapEvidence): boolean {
  return evidence.reference === "docs/sdd/mdd.md";
}
