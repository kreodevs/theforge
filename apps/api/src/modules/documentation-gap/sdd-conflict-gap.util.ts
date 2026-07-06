import { createHash } from "node:crypto";
import type { AffectedArtifact, ReportDocumentationGapBody } from "@theforge/shared-types";
import { reportDocumentationGapBodySchema } from "@theforge/shared-types";

export interface SddCorpusProjectFields {
  blueprintContent?: string | null;
  tasksContent?: string | null;
  architectureContent?: string | null;
  specContent?: string | null;
  apiContractsContent?: string | null;
  logicFlowsContent?: string | null;
  uxUiGuideContent?: string | null;
  infraContent?: string | null;
  useCasesContent?: string | null;
  userStoriesContent?: string | null;
}

export interface SddConflictGapMapping {
  affectedArtifacts: AffectedArtifact[];
  reference: string;
}

/** Corpus SDD unificado (misma composición que gobernanza) para detectar conflictos. */
export function buildSddCorpusFromProject(
  mddMarkdown: string,
  project: SddCorpusProjectFields,
): string {
  return [
    mddMarkdown,
    project.blueprintContent ?? "",
    project.tasksContent ?? "",
    project.architectureContent ?? "",
    project.specContent ?? "",
    project.apiContractsContent ?? "",
    project.logicFlowsContent ?? "",
    project.uxUiGuideContent ?? "",
    project.infraContent ?? "",
    project.useCasesContent ?? "",
    project.userStoriesContent ?? "",
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
}

export function computeDocumentationGapDedupHash(
  projectId: string,
  stageId: string,
  reference: string,
  description: string,
): string {
  const normalized = `${projectId}|${stageId}|${reference.trim().toLowerCase()}|${description.trim().toLowerCase()}`;
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function resolveSddConflictGapMapping(conflict: string): SddConflictGapMapping {
  if (/TypeORM vs Prisma/i.test(conflict)) {
    return {
      affectedArtifacts: ["tasks", "mdd", "blueprint"],
      reference: "§2 Stack técnico (MDD)",
    };
  }
  if (/prioriza BullMQ|BullMQ\/Bull|BullMQ \+ Redis/i.test(conflict)) {
    return {
      affectedArtifacts: ["tasks", "userStories", "mdd"],
      reference: "§2 Arquitectura y Stack (MDD)",
    };
  }
  if (/prioriza RabbitMQ|Kafka vs RabbitMQ/i.test(conflict)) {
    return {
      affectedArtifacts: ["tasks", "userStories", "mdd"],
      reference: "§2 Arquitectura y Stack (MDD)",
    };
  }
  if (/JWT:/i.test(conflict) || /JWT_SECRET|RS256/i.test(conflict)) {
    return {
      affectedArtifacts: ["tasks", "mdd"],
      reference: "§6 Seguridad y autenticación (MDD)",
    };
  }
  if (/Hashing bootstrap|Argon2|bcrypt/i.test(conflict)) {
    return {
      affectedArtifacts: ["tasks", "mdd"],
      reference: "§6 Seguridad — hashing bootstrap (MDD)",
    };
  }
  if (/Frontend:|React Hook Form|post-MVP/i.test(conflict)) {
    return {
      affectedArtifacts: ["blueprint", "uxUiGuide"],
      reference: "§1 Alcance MVP (MDD)",
    };
  }
  if (/MySQL vs PostgreSQL/i.test(conflict)) {
    return {
      affectedArtifacts: ["mdd", "tasks"],
      reference: "§3 Modelo de datos (MDD)",
    };
  }
  return {
    affectedArtifacts: ["mdd", "tasks"],
    reference: "docs/sdd/mdd.md",
  };
}

function ensureActionableDescription(conflict: string, mapping: SddConflictGapMapping): string {
  const trimmed = conflict.trim();
  if (trimmed.length >= 40) return trimmed;
  const suffix = ` Alinear ${mapping.affectedArtifacts.join(", ")} con ${mapping.reference}.`;
  return (trimmed + suffix).slice(0, 2000);
}

function extractEvidenceSnippet(corpus: string | undefined, conflict: string): string | undefined {
  if (!corpus?.trim()) return undefined;
  const tokens = conflict
    .split(/[\s:;,.\-–—/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !/^(prioriza|ignora|documenta|debe|para|del|los|las|con)$/i.test(t))
    .slice(0, 6);
  if (tokens.length === 0) return undefined;
  const lines = corpus
    .split("\n")
    .filter((line) => {
      const lower = line.toLowerCase();
      return tokens.some((t) => lower.includes(t.toLowerCase()));
    })
    .slice(0, 5);
  if (lines.length === 0) return undefined;
  return lines.join("\n").slice(0, 4000);
}

/** Mapea un mensaje de `detectSddConflicts` a cuerpo válido para `reportGap`. */
export function mapSddConflictToGapBody(
  conflict: string,
  corpus?: string,
): ReportDocumentationGapBody {
  const mapping = resolveSddConflictGapMapping(conflict);
  const description = ensureActionableDescription(conflict, mapping);
  const snippet = extractEvidenceSnippet(corpus, conflict);
  const body: ReportDocumentationGapBody = {
    description,
    evidence: {
      reference: mapping.reference,
      ...(snippet ? { snippet } : {}),
    },
    affectedArtifacts: mapping.affectedArtifacts,
  };
  return reportDocumentationGapBodySchema.parse(body);
}

export function mapSddConflictsToGapBodies(
  conflicts: string[],
  corpus?: string,
): ReportDocumentationGapBody[] {
  const seen = new Set<string>();
  const bodies: ReportDocumentationGapBody[] = [];
  for (const conflict of conflicts) {
    const body = mapSddConflictToGapBody(conflict, corpus);
    const key = `${body.evidence.reference}|${body.description.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bodies.push(body);
  }
  return bodies;
}
