import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import {
  LONG_JOB_LOCK_DURATION_MS,
  longRunningBullmqWorkerOptions,
} from "../../../common/bullmq-long-job.worker-options.js";
import { getRequestUserId, runWithRequestUserAsync } from "../../../common/request-user.store.js";
import { ProjectGenerationGuardService } from "../../projects/project-generation-guard.service.js";
import { LegacyCoordinatorService } from "../../legacy-flow/legacy-coordinator.service.js";
import { AiAnalysisService } from "../ai-analysis.service.js";

export const MDD_QUEUE_NAME = "theforge-mdd";

export type MddJobMode = "pipeline" | "manager" | "section" | "legacy";

export interface MddJobData {
  mode: MddJobMode;
  projectId: string;
  stageId?: string;
  userId?: string;
  dbgaContent?: string;
  initialMessage?: string;
  mddContent?: string;
  section?: number;
  gapReasons?: string[];
}

export type MddJobProgress = {
  agent?: string;
  message?: string;
  phase?: string;
  mddLength?: number;
  section?: number;
};

export type MddJobResult = {
  ok: boolean;
  mode: MddJobMode;
  projectId: string;
  stageId?: string;
  mddLength?: number;
  outcome?: "done" | "interrupt";
  threadId?: string;
  interrupt?: {
    reply?: string;
    questions?: string[];
    planMessage?: string;
  };
};

export interface MddJobStatus {
  jobId: string;
  projectId?: string;
  mode: MddJobMode | null;
  status: "queued" | "active" | "completed" | "failed" | "retrying" | "unknown";
  progress: unknown;
  result?: MddJobResult;
  error?: string;
  attemptsMade: number;
  maxAttempts: number;
  createdAt: number;
  finishedAt?: number;
}

type InMemoryMddJobRecord = {
  data: MddJobData;
  status: MddJobStatus["status"];
  progress: unknown;
  result?: MddJobResult;
  error?: string;
  createdAt: number;
  finishedAt?: number;
};

@Injectable()
export class MddQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MddQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private readonly inMemoryJobs = new Map<string, InMemoryMddJobRecord>();
  private readonly inMemoryRunningProjects = new Set<string>();
  private readonly inMemoryPendingByProject = new Map<string, string[]>();
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    @Inject(forwardRef(() => AiAnalysisService))
    private readonly aiAnalysis: AiAnalysisService,
    @Inject(forwardRef(() => LegacyCoordinatorService))
    private readonly legacyCoordinator: LegacyCoordinatorService,
    @Inject(forwardRef(() => ProjectGenerationGuardService))
    private readonly generationGuard: ProjectGenerationGuardService,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  usesRedis(): boolean {
    return !!process.env.REDIS_URL?.trim();
  }

  /** True si hay job MDD en cola o ejecutándose (incl. stream SSE activo). */
  isProjectBusy(projectId: string): boolean {
    if (this.generationGuard.isMddStreamActive(projectId)) return true;
    if (this.inMemoryRunningProjects.has(projectId)) return true;
    const pending = this.inMemoryPendingByProject.get(projectId);
    if (pending?.length) return true;
    return false;
  }

  async listActiveJobsForProject(
    projectId: string,
  ): Promise<Array<{ jobId: string; mode: MddJobMode; status: "queued" | "active" }>> {
    const out: Array<{ jobId: string; mode: MddJobMode; status: "queued" | "active" }> = [];
    for (const [jobId, mem] of this.inMemoryJobs) {
      if (mem.data.projectId !== projectId) continue;
      if (mem.status === "queued" || mem.status === "active") {
        out.push({ jobId, mode: mem.data.mode, status: mem.status });
      }
    }
    if (!this.queue) return out;
    const states = ["waiting", "active", "delayed"] as const;
    for (const state of states) {
      const jobs = await this.queue.getJobs([state], 0, 100);
      for (const job of jobs) {
        const data = job.data as MddJobData | undefined;
        if (data?.projectId !== projectId) continue;
        out.push({
          jobId: String(job.id),
          mode: data.mode,
          status: state === "active" ? "active" : "queued",
        });
      }
    }
    return out;
  }

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.logger.log("BullMQ MDD: sin REDIS_URL — cola in-memory (sobrevive cerrar navegador, no restart API)");
      return;
    }
    this.queue = new Queue(MDD_QUEUE_NAME, {
      connection: { url },
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 80 },
        removeOnFail: { age: 86_400, count: 30 },
        attempts: this.MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 5_000 },
      },
    });
    const workerOpts = longRunningBullmqWorkerOptions({ concurrency: 1 });
    this.worker = new Worker(
      MDD_QUEUE_NAME,
      async (job: Job<MddJobData>, token?: string) => {
        const { userId } = job.data;
        return runWithRequestUserAsync(userId ?? "system", async () => {
          this.logger.log(
            `BullMQ MDD job ${job.id} mode=${job.data.mode} projectId=${job.data.projectId}`,
          );
          const onProgress = async (p: MddJobProgress) => {
            await job.updateProgress(p);
            if (!token) return;
            try {
              await job.extendLock(token, LONG_JOB_LOCK_DURATION_MS);
            } catch {
              // Worker timer still renews; ignore if lock already lost (logged by BullMQ).
            }
          };
          return this.executeJob(job.data, onProgress);
        });
      },
      { connection: { url }, ...workerOpts },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(
        `BullMQ MDD job ${job?.id} falló: ${err instanceof Error ? err.message : err}`,
      );
    });
    this.logger.log(
      `BullMQ MDD worker activo (${MDD_QUEUE_NAME}), lockDuration=${workerOpts.lockDuration}ms, concurrency=1`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private assertCanEnqueue(projectId: string): void {
    if (this.isProjectBusy(projectId)) {
      throw new ConflictException(
        "Ya hay una generación de MDD en curso para este proyecto. Espera a que termine o recarga el estado.",
      );
    }
  }

  async enqueue(data: MddJobData): Promise<string> {
    this.assertCanEnqueue(data.projectId);
    const userId = data.userId ?? getRequestUserId();
    const payload: MddJobData = { ...data, userId };

    if (this.queue) {
      const job = await this.queue.add(payload.mode, payload);
      return String(job.id);
    }
    return this.enqueueInMemory(payload);
  }

  private enqueueInMemory(data: MddJobData): string {
    const jobId = randomUUID();
    this.inMemoryJobs.set(jobId, {
      data,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
    });
    const pending = this.inMemoryPendingByProject.get(data.projectId) ?? [];
    pending.push(jobId);
    this.inMemoryPendingByProject.set(data.projectId, pending);
    this.logger.log(`In-memory MDD job ${jobId} encolado mode=${data.mode} projectId=${data.projectId}`);
    setImmediate(() => this.pumpInMemoryQueue(data.projectId));
    return jobId;
  }

  private pumpInMemoryQueue(projectId: string): void {
    if (this.inMemoryRunningProjects.has(projectId)) return;
    const pending = this.inMemoryPendingByProject.get(projectId);
    if (!pending?.length) return;
    const nextJobId = pending.shift();
    if (!nextJobId) return;
    if (pending.length === 0) this.inMemoryPendingByProject.delete(projectId);
    const record = this.inMemoryJobs.get(nextJobId);
    if (!record || record.status !== "queued") {
      this.pumpInMemoryQueue(projectId);
      return;
    }
    this.inMemoryRunningProjects.add(projectId);
    this.startInMemoryJob(nextJobId, record.data);
  }

  private startInMemoryJob(jobId: string, data: MddJobData): void {
    const record = this.inMemoryJobs.get(jobId);
    if (!record) return;
    record.status = "active";

    void runWithRequestUserAsync(data.userId ?? "system", async () => {
      try {
        const result = await this.executeJob(data, (p) => {
          record.progress = p;
        });
        record.status = "completed";
        record.result = result;
        record.finishedAt = Date.now();
      } catch (err) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : String(err);
        record.finishedAt = Date.now();
      } finally {
        this.inMemoryRunningProjects.delete(data.projectId);
        this.pumpInMemoryQueue(data.projectId);
      }
    });
  }

  private async executeJob(
    data: MddJobData,
    onProgress: (p: MddJobProgress) => void | Promise<void>,
  ): Promise<MddJobResult> {
    const { projectId } = data;
    this.generationGuard.registerMddStream(projectId);
    try {
      if (data.mode === "legacy") {
        onProgress({ phase: "legacy", message: "Generando MDD desde codebase…" });
        const res = await this.legacyCoordinator.generateMdd(projectId, data.stageId, {
          includeContent: false,
        });
        return {
          ok: res.ok,
          mode: "legacy",
          projectId,
          stageId: res.stageId,
          mddLength: res.mddLength,
          outcome: "done",
        };
      }
      return await this.aiAnalysis.runMddGenerationJob(data, onProgress);
    } finally {
      this.generationGuard.unregisterMddStream(projectId);
    }
  }

  async getJobStatus(jobId: string): Promise<MddJobStatus> {
    const mem = this.inMemoryJobs.get(jobId);
    if (mem) {
      return {
        jobId,
        projectId: mem.data.projectId,
        mode: mem.data.mode,
        status: mem.status,
        progress: mem.progress,
        result: mem.result,
        error: mem.error,
        attemptsMade: mem.status === "failed" ? 1 : 0,
        maxAttempts: this.MAX_ATTEMPTS,
        createdAt: mem.createdAt,
        finishedAt: mem.finishedAt,
      };
    }
    if (!this.queue) {
      return {
        jobId,
        mode: null,
        status: "unknown",
        progress: 0,
        attemptsMade: 0,
        maxAttempts: this.MAX_ATTEMPTS,
        createdAt: 0,
      };
    }
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return {
        jobId,
        mode: null,
        status: "unknown",
        progress: 0,
        attemptsMade: 0,
        maxAttempts: this.MAX_ATTEMPTS,
        createdAt: 0,
      };
    }
    const jobData = job.data as MddJobData | undefined;
    const state = await job.getState();
    let status: MddJobStatus["status"];
    if (state === "completed") status = "completed";
    else if (state === "failed") {
      status = job.attemptsMade < (job.opts?.attempts ?? 1) ? "retrying" : "failed";
    } else if (state === "active") status = "active";
    else if (state === "delayed") status = "retrying";
    else if (state === "waiting" || state === "waiting-children") status = "queued";
    else status = "unknown";

    return {
      jobId,
      projectId: jobData?.projectId,
      mode: jobData?.mode ?? null,
      status,
      progress: job.progress ?? 0,
      result: (job.returnvalue as MddJobResult | undefined) ?? undefined,
      error: job.failedReason ?? undefined,
      attemptsMade: job.attemptsMade,
      maxAttempts: this.MAX_ATTEMPTS,
      createdAt: job.timestamp ?? Date.now(),
      finishedAt: job.finishedOn ?? undefined,
    };
  }
}
