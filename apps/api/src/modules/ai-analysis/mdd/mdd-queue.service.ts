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
import { BULLMQ_LONG_JOB_WORKER_OPTS } from "../../../common/bullmq-long-job.worker-options.js";
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

export type MddCancelResult = {
  ok: true;
  cancelled: boolean;
  jobIds: string[];
  /** Job activo en worker: se detendrá cooperativamente entre pasos del grafo. */
  activeJobCooperative?: boolean;
};

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
  /** Proyectos cuyo job MDD el usuario pidió cancelar (evita re-encolar tras remove). */
  private readonly cancelledProjects = new Set<string>();
  /** Evita spam de cancelaciones repetidas (p. ej. doble clic en Detener). */
  private readonly cancelInFlightUntil = new Map<string, number>();
  private readonly lastCancelResult = new Map<string, MddCancelResult>();
  private static readonly CANCEL_DEDUPE_MS = 2_000;
  private readonly MAX_ATTEMPTS = 3;
  static readonly CANCELLED_MESSAGE = "Cancelado por el usuario";
  static readonly ORPHAN_RECOVERY_MESSAGE =
    "Recuperado tras reinicio del API (job huérfano)";

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

  isProjectCancelled(projectId: string): boolean {
    return this.cancelledProjects.has(projectId.trim());
  }

  /** True si hay job MDD in-memory o stream SSE activo (no consulta Redis). */
  isProjectBusy(projectId: string): boolean {
    if (this.cancelledProjects.has(projectId)) return true;
    if (this.generationGuard.isMddStreamActive(projectId)) return true;
    if (this.inMemoryRunningProjects.has(projectId)) return true;
    const pending = this.inMemoryPendingByProject.get(projectId);
    if (pending?.length) return true;
    return false;
  }

  /** Incluye cola BullMQ (waiting/active/delayed) además del estado in-memory. */
  async isProjectBusyAsync(projectId: string): Promise<boolean> {
    if (this.isProjectBusy(projectId)) return true;
    if (!this.queue) return false;
    const active = await this.listActiveJobsForProject(projectId);
    return active.length > 0;
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
    await this.recoverOrphanedActiveJobs();
    this.worker = new Worker(
      MDD_QUEUE_NAME,
      async (job: Job<MddJobData>) => {
        const { userId } = job.data;
        return runWithRequestUserAsync(userId ?? "system", async () => {
          this.logger.log(
            `BullMQ MDD job ${job.id} mode=${job.data.mode} projectId=${job.data.projectId}`,
          );
          return this.executeJob(job.data, (p) => job.updateProgress(p), String(job.id));
        });
      },
      { connection: { url }, concurrency: 1, ...BULLMQ_LONG_JOB_WORKER_OPTS },
    );
    this.worker.on("failed", (job, err) => {
      const data = job?.data as MddJobData | undefined;
      if (data?.projectId) {
        this.generationGuard.unregisterMddStream(data.projectId);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === MddQueueService.CANCELLED_MESSAGE) {
          this.clearCancelState(data.projectId);
          this.clearCancelDedupe(data.projectId);
        }
      }
      this.logger.error(
        `BullMQ MDD job ${job?.id} falló: ${err instanceof Error ? err.message : err}`,
      );
    });
    this.logger.log(
      `BullMQ MDD worker activo (${MDD_QUEUE_NAME}), stalledInterval=${BULLMQ_LONG_JOB_WORKER_OPTS.stalledInterval}ms`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async assertCanEnqueue(projectId: string): Promise<void> {
    if (await this.isProjectBusyAsync(projectId)) {
      throw new ConflictException(
        "Ya hay una generación de MDD en curso para este proyecto. Espera a que termine o recarga el estado.",
      );
    }
  }

  /**
   * Jobs que quedaron `active` en Redis cuando murió el worker anterior (p. ej. restart API).
   */
  private async recoverOrphanedActiveJobs(): Promise<void> {
    if (!this.queue) return;
    const activeJobs = await this.queue.getJobs(["active"], 0, 200);
    if (!activeJobs.length) return;

    for (const job of activeJobs) {
      const data = job.data as MddJobData | undefined;
      const projectId = data?.projectId?.trim();
      const jobId = String(job.id);
      try {
        await job.moveToFailed(
          new Error(MddQueueService.ORPHAN_RECOVERY_MESSAGE),
          "0",
          true,
        );
        if (projectId) {
          this.generationGuard.unregisterMddStream(projectId);
        }
        this.logger.warn(
          `Job MDD huérfano ${jobId} (projectId=${projectId ?? "?"}) marcado como fallido tras reinicio del API`,
        );
      } catch (err) {
        this.logger.warn(
          `No se pudo recuperar job MDD huérfano ${jobId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  async enqueue(data: MddJobData): Promise<string> {
    await this.assertCanEnqueue(data.projectId);
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
    if (this.cancelledProjects.has(projectId)) {
      this.markInMemoryJobCancelled(nextJobId, record);
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
        }, jobId);
        record.status = "completed";
        record.result = result;
        record.finishedAt = Date.now();
      } catch (err) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : String(err);
        record.finishedAt = Date.now();
        if (record.error === MddQueueService.CANCELLED_MESSAGE) {
          this.clearCancelState(data.projectId);
          this.clearCancelDedupe(data.projectId);
        }
      } finally {
        this.inMemoryRunningProjects.delete(data.projectId);
        this.pumpInMemoryQueue(data.projectId);
      }
    });
  }

  private assertNotCancelled(projectId: string): void {
    if (this.cancelledProjects.has(projectId)) {
      throw new Error(MddQueueService.CANCELLED_MESSAGE);
    }
  }

  private clearCancelState(projectId: string): void {
    this.cancelledProjects.delete(projectId.trim());
  }

  private clearCancelDedupe(projectId: string): void {
    const trimmed = projectId.trim();
    this.cancelInFlightUntil.delete(trimmed);
    this.lastCancelResult.delete(trimmed);
  }

  private markInMemoryJobCancelled(_jobId: string, record: InMemoryMddJobRecord): void {
    record.status = "failed";
    record.error = MddQueueService.CANCELLED_MESSAGE;
    record.finishedAt = Date.now();
    this.inMemoryRunningProjects.delete(record.data.projectId);
  }

  /**
   * Cancela jobs MDD en cola o en curso para un proyecto. Idempotente si ya terminaron.
   * Jobs activos (locked por el worker) usan cancelación cooperativa vía {@link cancelledProjects}.
   */
  async cancelProjectJobs(projectId: string): Promise<MddCancelResult> {
    const trimmed = projectId.trim();
    if (!trimmed) return { ok: true, cancelled: false, jobIds: [] };

    const now = Date.now();
    const inflightUntil = this.cancelInFlightUntil.get(trimmed);
    if (inflightUntil != null && inflightUntil > now) {
      const cached = this.lastCancelResult.get(trimmed);
      if (cached) return cached;
      return { ok: true, cancelled: true, jobIds: [], activeJobCooperative: true };
    }
    this.cancelInFlightUntil.set(trimmed, now + MddQueueService.CANCEL_DEDUPE_MS);

    const wasBusy =
      this.generationGuard.isMddStreamActive(trimmed) ||
      this.inMemoryRunningProjects.has(trimmed) ||
      (this.inMemoryPendingByProject.get(trimmed)?.length ?? 0) > 0 ||
      (await this.listActiveJobsForProject(trimmed)).length > 0;

    this.cancelledProjects.add(trimmed);
    this.generationGuard.unregisterMddStream(trimmed);

    const cancelledJobIds: string[] = [];
    let activeJobCooperative = false;

    const pending = this.inMemoryPendingByProject.get(trimmed) ?? [];
    for (const jobId of pending) {
      const record = this.inMemoryJobs.get(jobId);
      if (record && record.status === "queued") {
        this.markInMemoryJobCancelled(jobId, record);
        cancelledJobIds.push(jobId);
      }
    }
    this.inMemoryPendingByProject.delete(trimmed);

    for (const [jobId, record] of this.inMemoryJobs) {
      if (record.data.projectId !== trimmed) continue;
      if (record.status === "active") {
        activeJobCooperative = true;
        cancelledJobIds.push(jobId);
      }
    }

    if (this.queue) {
      const states = ["waiting", "delayed", "active"] as const;
      const seenJobIds = new Set<string>();
      for (const state of states) {
        const jobs = await this.queue.getJobs([state], 0, 100);
        for (const job of jobs) {
          const data = job.data as MddJobData | undefined;
          if (data?.projectId !== trimmed) continue;
          const jobId = String(job.id);
          if (seenJobIds.has(jobId)) continue;
          seenJobIds.add(jobId);

          const actualState = await job.getState();
          if (actualState === "active") {
            activeJobCooperative = true;
            cancelledJobIds.push(jobId);
            this.logger.log(
              `Cancelación cooperativa solicitada para job MDD activo ${jobId} (índice cola=${state})`,
            );
            continue;
          }
          if (
            actualState === "waiting" ||
            actualState === "delayed" ||
            actualState === "waiting-children"
          ) {
            try {
              await job.remove();
              cancelledJobIds.push(jobId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("locked")) {
                activeJobCooperative = true;
                cancelledJobIds.push(jobId);
                this.logger.log(
                  `Job MDD ${jobId} bloqueado (${actualState}); cancelación cooperativa`,
                );
              } else {
                this.logger.warn(
                  `No se pudo eliminar job MDD ${jobId} (${actualState}): ${msg}`,
                );
              }
            }
          }
        }
      }
    }

    const result: MddCancelResult = {
      ok: true,
      cancelled: wasBusy || cancelledJobIds.length > 0,
      jobIds: [...new Set(cancelledJobIds)],
      ...(activeJobCooperative ? { activeJobCooperative: true } : {}),
    };
    this.lastCancelResult.set(trimmed, result);
    if (!activeJobCooperative) {
      this.clearCancelState(trimmed);
    }
    return result;
  }

  private async executeJob(
    data: MddJobData,
    onProgress: (p: MddJobProgress) => void,
    correlationId?: string,
  ): Promise<MddJobResult> {
    const { projectId } = data;
    const traceId = correlationId ?? randomUUID();
    this.assertNotCancelled(projectId);
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
      return await this.aiAnalysis.runMddGenerationJob(data, onProgress, { correlationId: traceId });
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
