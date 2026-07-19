import { ConflictException, Inject, Injectable, forwardRef } from "@nestjs/common";
import type { ComplexityLevel } from "@theforge/shared-types";
import {
  buildDeliverableReadiness,
  buildGenerationGates,
  evaluateGenerationGate,
  type GenerationJobSnapshot,
  type GenerationJobType,
  type ProjectGenerationStatus,
} from "@theforge/shared-types";
import { ProjectsService } from "./projects.service.js";
import { DeliverablesQueueService } from "./deliverables-queue.service.js";
import { MddQueueService } from "../ai-analysis/mdd/mdd-queue.service.js";
import { MddUpstreamSyncService } from "../ai-analysis/mdd/mdd-upstream-sync.service.js";

type TrackedBgJob = {
  projectId: string;
  type: GenerationJobType;
  status: "queued" | "active" | "retrying";
};

/**
 * Orquesta un job activo por proyecto, bloqueo durante stream MDD y gates de dependencias upstream.
 */
@Injectable()
export class ProjectGenerationGuardService {
  private readonly mddStreams = new Set<string>();
  private readonly bgJobs = new Map<string, TrackedBgJob>();

  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    @Inject(forwardRef(() => DeliverablesQueueService))
    private readonly deliverablesQueue: DeliverablesQueueService,
    @Inject(forwardRef(() => MddQueueService))
    private readonly mddQueue: MddQueueService,
    @Inject(forwardRef(() => MddUpstreamSyncService))
    private readonly mddUpstreamSync: MddUpstreamSyncService,
  ) {}

  registerMddStream(projectId: string): void {
    this.mddStreams.add(projectId);
  }

  unregisterMddStream(projectId: string): void {
    this.mddStreams.delete(projectId);
  }

  isMddStreamActive(projectId: string): boolean {
    return this.mddStreams.has(projectId);
  }

  registerBackgroundJob(jobId: string, projectId: string, type: GenerationJobType): void {
    this.bgJobs.set(jobId, { projectId, type, status: "queued" });
  }

  markBackgroundJobActive(jobId: string): void {
    const job = this.bgJobs.get(jobId);
    if (job) job.status = "active";
  }

  finishBackgroundJob(jobId: string): void {
    this.bgJobs.delete(jobId);
  }

  async assertCanEnqueue(projectId: string, type: GenerationJobType): Promise<void> {
    const status = await this.getStatus(projectId);
    const gate = evaluateGenerationGate({
      complexity: status.complexity,
      contentReady: status.contentReady,
      mddStreamActive: status.mddStreamActive,
      activeJobs: [...status.queuedJobs, ...(status.activeJob ? [status.activeJob] : [])],
      requestedType: type,
    });
    if (!gate.allowed) {
      throw new ConflictException(gate.reason ?? "Generación bloqueada por dependencias u otro job en curso.");
    }
  }

  async getStatus(projectId: string, stageId?: string | null): Promise<
    ProjectGenerationStatus & {
      complexity: ComplexityLevel;
      contentReady: ReturnType<typeof buildDeliverableReadiness>;
    }
  > {
    const project = await this.projects.findOne(projectId);
    const complexity = ((project as { complexity?: ComplexityLevel }).complexity ?? "HIGH") as ComplexityLevel;
    const contentReady = buildDeliverableReadiness(project as Record<string, unknown>);
    const mddStreamActive =
      this.isMddStreamActive(projectId) || this.mddQueue.isProjectBusy(projectId);

    const queueJobs = await this.deliverablesQueue.listActiveJobsForProject(projectId);
    const bgSnapshots: GenerationJobSnapshot[] = [];
    for (const [jobId, job] of this.bgJobs) {
      if (job.projectId !== projectId) continue;
      if (job.status === "queued" || job.status === "active" || job.status === "retrying") {
        bgSnapshots.push({ jobId, type: job.type, status: job.status });
      }
    }

    const mddJobs = await this.mddQueue.listJobsForProject(projectId);

    const merged = [...queueJobs, ...bgSnapshots];
    const activeJob = merged.find((j) => j.status === "active") ?? merged.find((j) => j.status === "retrying") ?? null;
    const queuedJobs = merged.filter((j) => j.status === "queued");

    const activeJobsForGates = merged.filter(
      (j) => j.status === "queued" || j.status === "active" || j.status === "retrying",
    );

    const gates = buildGenerationGates({
      complexity,
      contentReady,
      mddStreamActive,
      activeJobs: activeJobsForGates,
    });

    const busy = mddStreamActive || activeJobsForGates.length > 0;

    let mddUpstreamSync = null;
    try {
      const analysis = await this.mddUpstreamSync.analyze(projectId, stageId);
      mddUpstreamSync = {
        pendingSync: analysis.pendingSync,
        changedSources: analysis.changedSources,
        recommendedSections: analysis.recommendedSections,
        expandedSections: analysis.expandedSections,
        canSync: analysis.canSync,
        needsFullRegen: analysis.needsFullRegen,
        hasBaseline: analysis.hasBaseline,
        changes: analysis.changes,
      };
    } catch {
      mddUpstreamSync = null;
    }

    return {
      busy,
      mddStreamActive,
      mddJobs,
      activeJob,
      queuedJobs,
      gates,
      complexity,
      contentReady,
      mddUpstreamSync,
    };
  }
}
