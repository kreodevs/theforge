import {
  BadRequestException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
import { AgentSessionLogService } from "./agent-session-log.service.js";
import { DocReconcileService } from "./doc-reconcile.service.js";
import { ArchitectureDecisionService } from "./architecture-decision.service.js";
import type { AffectedArtifact as AffectedArtifactType } from "@theforge/shared-types";
import { detectSddConflicts } from "../ai/utils/suggest-agent-governance-artifacts.js";
import {
  buildSddCorpusFromProject,
  computeDocumentationGapDedupHash,
  mapSddConflictsToGapBodies,
  type SddCorpusProjectFields,
} from "./sdd-conflict-gap.util.js";
import { alignSddDeliverablesAtPersist } from "./sdd-align-at-persist.util.js";
import { evaluateMddDeliveryGatePrepared } from "../ai-analysis/utils/mdd-delivery-gate-guard.util.js";
import { readDeliveryGateSnapshot } from "../ai-analysis/utils/mdd-delivery-gate.util.js";

const SDD_AUTO_RECONCILE_MAX_RETRIES = 3;

export interface AutoReconcileSddConflictsResult {
  clean: boolean;
  retries: number;
  deterministicPasses: number;
  reconcilePasses: number;
  remainingConflicts: string[];
}

export interface DetectAndSurfaceSddConflictsResult {
  conflictsDetected: number;
  gapsCreated: number;
  duplicates: number;
  failed: number;
}

/** Rollback: crear gaps HITL para conflictos SDD internos (comportamiento previo). */
export function isSddConflictHitlGapsEnabled(): boolean {
  return process.env.SDD_CONFLICT_HITL_GAPS?.trim() === "1";
}

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
    @Inject(forwardRef(() => DocReconcileService))
    private readonly docReconcile: DocReconcileService,
    @Inject(forwardRef(() => DeliverablesQueueService))
    private readonly deliverablesQueue: DeliverablesQueueService,
    private readonly architectureDecisions: ArchitectureDecisionService,
  ) {}

  private computeDedupHash(
    projectId: string,
    stageId: string,
    reference: string,
    description: string,
  ): string {
    return computeDocumentationGapDedupHash(projectId, stageId, reference, description);
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

  /**
   * Detecta conflictos SDD internos y los expone como gaps PENDING_APPROVAL sin auto-reconciliar.
   * Usar tras generación de entregables para que el usuario decida.
   */
  async detectAndSurfaceSddConflicts(
    projectId: string,
    stageId: string,
  ): Promise<DetectAndSurfaceSddConflictsResult> {
    const snapshot = await this.loadSddReconcileSnapshot(projectId, stageId);
    if (!snapshot) {
      return { conflictsDetected: 0, gapsCreated: 0, duplicates: 0, failed: 0 };
    }

    const conflicts = detectSddConflicts(snapshot.corpus);
    if (conflicts.length === 0) {
      return { conflictsDetected: 0, gapsCreated: 0, duplicates: 0, failed: 0 };
    }

    const bodies = mapSddConflictsToGapBodies(conflicts, snapshot.corpus);
    let gapsCreated = 0;
    let duplicates = 0;
    let failed = 0;

    for (const body of bodies) {
      try {
        const result = await this.reportGap(projectId, stageId, body);
        if (result.duplicate) duplicates++;
        else gapsCreated++;
      } catch {
        failed++;
      }
    }

    await this.agentSessionLog.append({
      projectId,
      stageId,
      kind: "GAP_REPORTED",
      summary: `Conflictos SDD detectados tras generación: ${conflicts.length}`,
      payload: {
        source: "sdd-conflict-surfacing",
        conflicts: conflicts.length,
        gapsCreated,
        duplicates,
      },
    });

    return {
      conflictsDetected: conflicts.length,
      gapsCreated,
      duplicates,
      failed,
    };
  }

  /**
   * Detecta conflictos SDD internos, aplica correcciones deterministas en DB y, si persisten,
   * reconcilia artefactos vía doc-reconcile sin HITL. Reintenta hasta limpio o max retries.
   */
  async autoReconcileSddConflicts(
    projectId: string,
    stageId: string,
  ): Promise<AutoReconcileSddConflictsResult> {
    let retries = 0;
    let deterministicPasses = 0;
    let reconcilePasses = 0;

    while (retries < SDD_AUTO_RECONCILE_MAX_RETRIES) {
      const snapshot = await this.loadSddReconcileSnapshot(projectId, stageId);
      if (!snapshot) {
        return {
          clean: true,
          retries,
          deterministicPasses,
          reconcilePasses,
          remainingConflicts: [],
        };
      }

      const { mddMarkdown, corpus, projectFields } = snapshot;
      const conflicts = detectSddConflicts(corpus);
      if (conflicts.length === 0) {
        return {
          clean: true,
          retries,
          deterministicPasses,
          reconcilePasses,
          remainingConflicts: [],
        };
      }

      const aligned = alignSddDeliverablesAtPersist({
        mddContent: mddMarkdown,
        tasksContent: projectFields.tasksContent,
        userStoriesContent: projectFields.userStoriesContent,
        blueprintContent: projectFields.blueprintContent,
        infraContent: projectFields.infraContent,
      });

      if (aligned.changed) {
        await this.persistAlignedSddDeliverables(projectId, stageId, aligned);
        deterministicPasses++;
        retries++;
        for (const conflict of conflicts) {
          await this.architectureDecisions.recordFromSddConflict(
            projectId,
            conflict,
            "auto-deterministic",
          );
        }
        await this.agentSessionLog.append({
          projectId,
          stageId,
          kind: "ARTIFACT_UPDATED",
          summary: "Alineación SDD determinista aplicada (ORM/cola/JWT)",
          payload: { source: "sdd-auto-align", conflicts: conflicts.length },
        });
        continue;
      }

      const bodies = mapSddConflictsToGapBodies(conflicts, corpus);
      const affectedSet = new Set<AffectedArtifactType>();
      for (const body of bodies) {
        for (const artifact of body.affectedArtifacts) {
          affectedSet.add(artifact);
        }
      }
      const affectedArtifacts = [...affectedSet];
      const gapsFeedback = bodies
        .map((b) => this.docReconcile.buildGapsFeedback(b.description, b.evidence))
        .join("\n\n---\n\n");

      await this.triggerAutoReconcileInternal(
        projectId,
        stageId,
        affectedArtifacts,
        gapsFeedback,
        conflicts,
      );
      reconcilePasses++;
      retries++;
    }

    const finalSnapshot = await this.loadSddReconcileSnapshot(projectId, stageId);
    const remainingConflicts = finalSnapshot
      ? detectSddConflicts(finalSnapshot.corpus)
      : [];

    return {
      clean: remainingConflicts.length === 0,
      retries,
      deterministicPasses,
      reconcilePasses,
      remainingConflicts,
    };
  }

  /**
   * @deprecated Usar `autoReconcileSddConflicts`. Solo activo con `SDD_CONFLICT_HITL_GAPS=1`.
   */
  async syncSddConflictsToDocumentationGaps(
    projectId: string,
    stageId: string,
    conflicts: string[],
    _corpus?: string,
  ): Promise<{ created: number; duplicates: number; failed: number }> {
    if (!isSddConflictHitlGapsEnabled()) {
      return { created: 0, duplicates: 0, failed: 0 };
    }
    if (conflicts.length === 0) {
      return { created: 0, duplicates: 0, failed: 0 };
    }

    const summary = await this.detectAndSurfaceSddConflicts(projectId, stageId);
    return {
      created: summary.gapsCreated,
      duplicates: summary.duplicates,
      failed: summary.failed,
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

    const stageRow = await this.prisma.stage.findUnique({
      where: { id: stageId },
      select: { shortTermContext: true, mddContent: true },
    });
    const snapshotGate = readDeliveryGateSnapshot(stageRow?.shortTermContext);
    const mddRaw = (stageRow?.mddContent ?? "").trim();
    const mddDeliveryGate =
      snapshotGate ??
      (mddRaw.length > 80 ? evaluateMddDeliveryGatePrepared(mddRaw) : null);

    return { gaps: rows.map((row) => this.toGapResponse(row)), mddDeliveryGate };
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

  private async loadSddReconcileSnapshot(
    projectId: string,
    stageId: string,
  ): Promise<{
    mddMarkdown: string;
    corpus: string;
    projectFields: SddCorpusProjectFields;
  } | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      include: { stages: { where: { id: stageId } } },
    });
    const stage = project?.stages[0];
    if (!project || !stage) return null;

    const mddMarkdown = (stage.mddContent ?? "").trim();
    const projectFields: SddCorpusProjectFields = {
      blueprintContent: project.blueprintContent,
      tasksContent: project.tasksContent,
      architectureContent: project.architectureContent,
      specContent: project.specContent,
      apiContractsContent: project.apiContractsContent,
      logicFlowsContent: project.logicFlowsContent,
      uxUiGuideContent: project.uxUiGuideContent,
      infraContent: project.infraContent,
      useCasesContent: project.useCasesContent,
      userStoriesContent: project.userStoriesContent,
    };
    const corpus = buildSddCorpusFromProject(mddMarkdown, projectFields);
    return { mddMarkdown, corpus, projectFields };
  }

  private async persistAlignedSddDeliverables(
    projectId: string,
    stageId: string,
    aligned: ReturnType<typeof alignSddDeliverablesAtPersist>,
  ): Promise<void> {
    const projectData: Record<string, string | null> = {};
    if (aligned.tasksContent !== undefined) projectData.tasksContent = aligned.tasksContent;
    if (aligned.userStoriesContent !== undefined) {
      projectData.userStoriesContent = aligned.userStoriesContent;
    }
    if (aligned.blueprintContent !== undefined) projectData.blueprintContent = aligned.blueprintContent;
    if (aligned.infraContent !== undefined) projectData.infraContent = aligned.infraContent;

    if (Object.keys(projectData).length > 0) {
      await this.prisma.project.update({ where: { id: projectId }, data: projectData });
    }
    if (aligned.mddContent) {
      await this.prisma.stage.update({
        where: { id: stageId },
        data: { mddContent: aligned.mddContent },
      });
    }
  }

  /** Reconciliación interna SDD: siempre síncrona para cerrar el bucle de detección. */
  private async triggerAutoReconcileInternal(
    projectId: string,
    stageId: string,
    affectedArtifacts: AffectedArtifact[],
    gapsFeedback: string,
    conflicts: string[],
  ): Promise<void> {
    const description = conflicts.map((c) => c.trim()).join(" | ").slice(0, 2000);
    const dedupHash = this.computeDedupHash(
      projectId,
      stageId,
      "docs/sdd/mdd.md",
      `[auto-reconcile] ${description}`,
    );

    const gap = await this.prisma.documentationGap.create({
      data: {
        projectId,
        stageId,
        status: "QUEUED",
        affectedArtifacts,
        description,
        evidence: { reference: "docs/sdd/mdd.md" },
        dedupHash,
      },
    });

    await this.agentSessionLog.append({
      projectId,
      stageId,
      kind: "RECONCILE_QUEUED",
      gapId: gap.id,
      summary: `Reconciliación SDD automática (${affectedArtifacts.join(", ")})`,
      payload: { source: "sdd-auto-reconcile", conflicts },
    });

    await this.docReconcile.executeReconcile({
      projectId,
      stageId,
      gapId: gap.id,
      affectedArtifacts,
      gapsFeedback,
    });
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
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, projectId },
    });
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
