import { z } from "zod";
import type { MddDeliveryGateResult } from "./mdd.js";

/** Artefactos SDD que pueden regenerarse parcialmente tras un gap reportado. */
export const affectedArtifactSchema = z.enum([
  "mdd",
  "spec",
  "architecture",
  "blueprint",
  "useCases",
  "userStories",
  "tasks",
  "apiContracts",
  "logicFlows",
  "infra",
  "uxUiGuide",
  "pantallas",
  "agentGovernance",
]);

export type AffectedArtifact = z.infer<typeof affectedArtifactSchema>;

const EVIDENCE_REFERENCE_RE =
  /(?:§\s*\d|§\d|T-\d+|docs\/sdd\/|tasks\.md|spec\.md|blueprint\.md|mdd\.md)/i;

export const documentationGapEvidenceSchema = z
  .object({
    reference: z
      .string()
      .min(1, "evidence.reference es obligatorio")
      .refine((v) => EVIDENCE_REFERENCE_RE.test(v), {
        message:
          "evidence.reference debe citar §, T-, docs/sdd/ o tasks.md (u otro artefacto SDD canónico)",
      }),
    codePaths: z.array(z.string().min(1).max(500)).max(20).optional(),
    snippet: z.string().max(4000).optional(),
  })
  .strict();

export type DocumentationGapEvidence = z.infer<typeof documentationGapEvidenceSchema>;

export const reportDocumentationGapBodySchema = z
  .object({
    description: z
      .string()
      .min(40, "description debe tener al menos 40 caracteres con detalle accionable"),
    evidence: documentationGapEvidenceSchema,
    affectedArtifacts: z
      .array(affectedArtifactSchema)
      .min(1, "Indica al menos un artefacto afectado"),
  })
  .strict();

export type ReportDocumentationGapBody = z.infer<typeof reportDocumentationGapBodySchema>;

export const documentationGapStatusSchema = z.enum([
  "OPEN",
  "PENDING_APPROVAL",
  "QUEUED",
  "RECONCILING",
  "RESOLVED",
  "REJECTED",
  "DUPLICATE",
]);

export type DocumentationGapStatus = z.infer<typeof documentationGapStatusSchema>;

export const agentSessionLogKindSchema = z.enum([
  "GAP_REPORTED",
  "RECONCILE_QUEUED",
  "ARTIFACT_UPDATED",
  "RECONCILE_REJECTED",
]);

export type AgentSessionLogKind = z.infer<typeof agentSessionLogKindSchema>;

export interface DocumentationGapResponse {
  id: string;
  projectId: string;
  stageId: string;
  status: DocumentationGapStatus;
  affectedArtifacts: AffectedArtifact[];
  description: string;
  evidence: DocumentationGapEvidence;
  dedupHash: string;
  jobId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface ReportDocumentationGapResponse {
  gap: DocumentationGapResponse;
  duplicate: boolean;
  queued: boolean;
  /** Gap creado pero reconciliación diferida hasta aprobación en Workshop. */
  pendingApproval?: boolean;
  jobId?: string;
}

export const rejectDocumentationGapBodySchema = z
  .object({
    reason: z.string().max(2000).optional(),
  })
  .strict();

export type RejectDocumentationGapBody = z.infer<typeof rejectDocumentationGapBodySchema>;

export interface DocumentationGapListResponse {
  gaps: DocumentationGapResponse[];
  /** Gate MDD de entrega (snapshot o evaluación en vivo) para UI de bloqueos. */
  mddDeliveryGate?: MddDeliveryGateResult | null;
}

export interface ApproveDocumentationGapResponse {
  gap: DocumentationGapResponse;
  queued: boolean;
  jobId?: string;
}

export interface RejectDocumentationGapResponse {
  gap: DocumentationGapResponse;
}

export interface AgentSessionLogEntry {
  id: string;
  projectId: string;
  stageId: string;
  kind: AgentSessionLogKind;
  gapId: string | null;
  summary: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentSessionLogListResponse {
  entries: AgentSessionLogEntry[];
}

/** Metadata embebida en handoff ZIP para vincular repo destino con The Forge. */
export interface TheforgeProjectJson {
  projectId: string;
  stageId: string;
  projectName: string;
  stageOrdinal: number;
  handoffVersion: string;
  exportedAt: string;
  artifactPaths: Record<string, string>;
  mcp: { tool: string };
  /** Resumen del gate de entrega MDD al exportar (≥9/10). */
  deliveryGate?: MddDeliveryGateResult;
}
