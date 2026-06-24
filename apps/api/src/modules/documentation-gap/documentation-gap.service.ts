import {
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
  DocumentationGapResponse,
  ReportDocumentationGapBody,
  ReportDocumentationGapResponse,
} from "@theforge/shared-types";
import { reportDocumentationGapBodySchema } from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import { getRequestUserId } from "../../common/request-user.store.js";
import { DeliverablesQueueService } from "../projects/deliverables-queue.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { AgentSessionLogService } from "./agent-session-log.service.js";
import { DocReconcileService } from "./doc-reconcile.service.js";

const RATE_LIMIT_PER_HOUR = 10;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    let jobId: string | undefined;
    let queued = false;

    if (this.deliverablesQueue.isEnabled()) {
      jobId = await this.deliverablesQueue.enqueue({
        type: "doc-reconcile-partial",
        projectId,
        userId: getRequestUserId(),
        gapId: gap.id,
        stageId,
        affectedArtifacts: dto.affectedArtifacts,
        gapsFeedback,
      });
      queued = true;
      await this.prisma.documentationGap.update({
        where: { id: gap.id },
        data: { status: "QUEUED", jobId },
      });
      await this.agentSessionLog.append({
        projectId,
        stageId,
        kind: "RECONCILE_QUEUED",
        gapId: gap.id,
        summary: `Reconciliación parcial encolada (${dto.affectedArtifacts.join(", ")})`,
        payload: { jobId, affectedArtifacts: dto.affectedArtifacts },
      });
    } else {
      await this.prisma.documentationGap.update({
        where: { id: gap.id },
        data: { status: "QUEUED" },
      });
      await this.agentSessionLog.append({
        projectId,
        stageId,
        kind: "RECONCILE_QUEUED",
        gapId: gap.id,
        summary: `Reconciliación parcial síncrona (${dto.affectedArtifacts.join(", ")})`,
      });
      await this.docReconcile.executeReconcile({
        projectId,
        stageId,
        gapId: gap.id,
        affectedArtifacts: dto.affectedArtifacts,
        gapsFeedback,
      });
    }

    const updated = await this.prisma.documentationGap.findUniqueOrThrow({ where: { id: gap.id } });
    return {
      gap: this.toGapResponse(updated),
      duplicate: false,
      queued,
      jobId,
    };
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
