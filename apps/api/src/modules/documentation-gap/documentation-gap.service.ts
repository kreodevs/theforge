import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  AffectedArtifact,
  ApproveDocumentationGapResponse,
  DocumentationGapEvidence,
  DocumentationGapListResponse,
  DocumentationGapResponse,
  RejectDocumentationGapResponse,
  ReportDocumentationGapBody,
  ReportDocumentationGapResponse,
} from "@theforge/shared-types";
import {
  rejectDocumentationGapBodySchema,
  reportDocumentationGapBodySchema,
} from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import { getRequestUserId } from "../../common/request-user.store.js";
import { DeliverablesQueueService } from "../projects/deliverables-queue.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { AgentSessionLogService } from "./agent-session-log.service.js";
import { DocReconcileService } from "./doc-reconcile.service.js";

const RATE_LIMIT_PER_HOUR = 10;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Reconciliación automática al reportar (comportamiento previo a HITL). */
export function isDocGapAutoApplyEnabled(): boolean {
  return process.env.DOC_GAP_AUTO_APPLY?.trim() === "1";
}

@Injectable()
export class DocumentationGapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentSessionLog: AgentSessionLogService,
    private readonly docReconcile: DocReconcileService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    @Inject(forwardRef(() => DeliverablesQueueService))
    private readonly deliverablesQueue: DeliverablesQueueService,
  ) {}

  private computeDedupHash(
    projectId: string,
    stageId: string,
    reference: string,
    description: string,
  ): string {
    const normalized = `${projectId}|${stageId}|${reference.trim().toLowerCase()}|${description.trim().toLowerCase()}`;
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  private toGapResponse(row: {
    id: string;
    projectId: string;
    stageId: string;
    status: string;
    affectedArtifacts: unknown;
    description: string;
    evidence: unknown;
    dedupHash: string;
    jobId: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): DocumentationGapResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      stageId: row.stageId,
      status: row.status as DocumentationGapResponse["status"],
      affectedArtifacts: row.affectedArtifacts as AffectedArtifact[],
      description: row.description,
      evidence: row.evidence as DocumentationGapResponse["evidence"],
      dedupHash: row.dedupHash,
      jobId: row.jobId,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }

  async reportGap(
    projectId: string,
    stageId: string,
    body: unknown,
  ): Promise<ReportDocumentationGapResponse> {
    const dto: ReportDocumentationGapBody = reportDocumentationGapBodySchema.parse(body);
    await this.assertStageAccess(projectId, stageId);
    await this.assertRateLimit(projectId);

    const dedupHash = this.computeDedupHash(
      projectId,
      stageId,
      dto.evidence.reference,
      dto.description,
    );

    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const duplicate = await this.prisma.documentationGap.findFirst({
      where: {
        dedupHash,
        createdAt: { gte: since },
        status: { notIn: ["REJECTED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (duplicate) {
      await this.agentSessionLog.append({
        projectId,
        stageId,
        kind: "GAP_REPORTED",
        gapId: duplicate.id,
        summary: `Gap duplicado (24h): ${dto.description.slice(0, 120)}`,
        payload: { duplicate: true, dedupHash },
      });
      return {
        gap: this.toGapResponse(duplicate),
        duplicate: true,
        queued: false,
      };
    }

    const gap = await this.prisma.documentationGap.create({
      data: {
        projectId,
        stageId,
        status: "OPEN",
        affectedArtifacts: dto.affectedArtifacts,
        description: dto.description,
        evidence: dto.evidence,
        dedupHash,
      },
    });

    await this.agentSessionLog.append({
      projectId,
      stageId,
      kind: "GAP_REPORTED",
      gapId: gap.id,
      summary: dto.description.slice(0, 500),
      payload: {
        affectedArtifacts: dto.affectedArtifacts,
        reference: dto.evidence.reference,
      },
    });

    const gapsFeedback = this.docReconcile.buildGapsFeedback(dto.description, dto.evidence);

    if (!isDocGapAutoApplyEnabled()) {
      await this.prisma.documentationGap.update({
        where: { id: gap.id },
        data: { status: "PENDING_APPROVAL" },
      });
      await this.agentSessionLog.append({
        projectId,
        stageId,
        kind: "GAP_REPORTED",
        gapId: gap.id,
        summary: `Pendiente de aprobación: ${dto.description.slice(0, 400)}`,
        payload: {
          pendingApproval: true,
          affectedArtifacts: dto.affectedArtifacts,
          reference: dto.evidence.reference,
        },
      });
      const updated = await this.prisma.documentationGap.findUniqueOrThrow({ where: { id: gap.id } });
      return {
        gap: this.toGapResponse(updated),
        duplicate: false,
        queued: false,
        pendingApproval: true,
      };
    }

    const { queued, jobId } = await this.triggerReconcile(
      projectId,
      stageId,
      gap.id,
      dto.affectedArtifacts,
      gapsFeedback,
    );

    const updated = await this.prisma.documentationGap.findUniqueOrThrow({ where: { id: gap.id } });
    return {
      gap: this.toGapResponse(updated),
      duplicate: false,
      queued,
      jobId,
    };
  }

  async listGaps(
    projectId: string,
    stageId: string,
    statusFilter?: string,
  ): Promise<DocumentationGapListResponse> {
    await this.assertStageAccess(projectId, stageId);
    const status =
      statusFilter === "pending"
        ? ("PENDING_APPROVAL" as const)
        : statusFilter
          ? (statusFilter.toUpperCase() as DocumentationGapResponse["status"])
          : undefined;

    const rows = await this.prisma.documentationGap.findMany({
      where: {
        projectId,
        stageId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { gaps: rows.map((row) => this.toGapResponse(row)) };
  }

  async approveGap(
    projectId: string,
    stageId: string,
    gapId: string,
  ): Promise<ApproveDocumentationGapResponse> {
    await this.assertStageAccess(projectId, stageId);
    const gap = await this.prisma.documentationGap.findFirst({
      where: { id: gapId, projectId, stageId },
    });
    if (!gap) throw new NotFoundException("Gap no encontrado");
    if (gap.status !== "PENDING_APPROVAL") {
      throw new BadRequestException("El gap no está pendiente de aprobación");
    }

    const affectedArtifacts = gap.affectedArtifacts as AffectedArtifact[];
    const evidence = gap.evidence as DocumentationGapEvidence;
    const gapsFeedback = this.docReconcile.buildGapsFeedback(gap.description, evidence);

    const { queued, jobId } = await this.triggerReconcile(
      projectId,
      stageId,
      gapId,
      affectedArtifacts,
      gapsFeedback,
    );

    const updated = await this.prisma.documentationGap.findUniqueOrThrow({ where: { id: gapId } });
    return {
      gap: this.toGapResponse(updated),
      queued,
      jobId,
    };
  }

  async rejectGap(
    projectId: string,
    stageId: string,
    gapId: string,
    body: unknown,
  ): Promise<RejectDocumentationGapResponse> {
    const dto = rejectDocumentationGapBodySchema.parse(body ?? {});
    await this.assertStageAccess(projectId, stageId);

    const gap = await this.prisma.documentationGap.findFirst({
      where: { id: gapId, projectId, stageId },
    });
    if (!gap) throw new NotFoundException("Gap no encontrado");
    if (gap.status !== "PENDING_APPROVAL") {
      throw new BadRequestException("El gap no está pendiente de aprobación");
    }

    const reason = dto.reason?.trim();
    const summary = reason || "Rechazado por el usuario en Workshop";

    await this.prisma.documentationGap.update({
      where: { id: gapId },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });

    await this.agentSessionLog.append({
      projectId,
      stageId,
      kind: "RECONCILE_REJECTED",
      gapId,
      summary: summary.slice(0, 500),
      payload: { humanReject: true, reason: reason ?? null },
    });

    const updated = await this.prisma.documentationGap.findUniqueOrThrow({ where: { id: gapId } });
    return { gap: this.toGapResponse(updated) };
  }

  private async triggerReconcile(
    projectId: string,
    stageId: string,
    gapId: string,
    affectedArtifacts: AffectedArtifact[],
    gapsFeedback: string,
  ): Promise<{ queued: boolean; jobId?: string }> {
    let jobId: string | undefined;
    let queued = false;

    if (this.deliverablesQueue.isEnabled()) {
      jobId = await this.deliverablesQueue.enqueue({
        type: "doc-reconcile-partial",
        projectId,
        userId: getRequestUserId(),
        gapId,
        stageId,
        affectedArtifacts,
        gapsFeedback,
      });
      queued = true;
      await this.prisma.documentationGap.update({
        where: { id: gapId },
        data: { status: "QUEUED", jobId },
      });
      await this.agentSessionLog.append({
        projectId,
        stageId,
        kind: "RECONCILE_QUEUED",
        gapId,
        summary: `Reconciliación parcial encolada (${affectedArtifacts.join(", ")})`,
        payload: { jobId, affectedArtifacts },
      });
    } else {
      await this.prisma.documentationGap.update({
        where: { id: gapId },
        data: { status: "QUEUED" },
      });
      await this.agentSessionLog.append({
        projectId,
        stageId,
        kind: "RECONCILE_QUEUED",
        gapId,
        summary: `Reconciliación parcial síncrona (${affectedArtifacts.join(", ")})`,
      });
      await this.docReconcile.executeReconcile({
        projectId,
        stageId,
        gapId,
        affectedArtifacts,
        gapsFeedback,
      });
    }

    return { queued, jobId };
  }

  private async assertStageAccess(projectId: string, stageId: string): Promise<void> {
    const project = await this.projects.findOne(projectId);
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    const stage = (project.stages ?? []).find((s) => s.id === stageId);
    if (!stage) throw new NotFoundException("Etapa no encontrada");
  }

  private async assertRateLimit(projectId: string): Promise<void> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.prisma.documentationGap.count({
      where: {
        projectId,
        createdAt: { gte: since },
        status: { not: "DUPLICATE" },
      },
    });
    if (count >= RATE_LIMIT_PER_HOUR) {
      throw new HttpException(
        `Límite de ${RATE_LIMIT_PER_HOUR} gaps/hora por proyecto alcanzado`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
