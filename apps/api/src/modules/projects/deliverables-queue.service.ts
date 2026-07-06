import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  forwardRef,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import type { AffectedArtifact } from "@theforge/shared-types";
import { getRequestUserId, runWithRequestUserAsync } from "../../common/request-user.store.js";
import { DocReconcileService } from "../documentation-gap/doc-reconcile.service.js";
import { ProjectsService } from "./projects.service.js";

export const DELIVERABLES_QUEUE_NAME = "theforge-deliverables";

/** Tipos de job soportados por la cola. */
export type GenerateJobType =
  | "cascade"
  | "blueprint"
  | "api-contracts"
  | "logic-flows"
  | "tasks"
  | "agent-governance"
  | "infra"
  | "architecture"
  | "use-cases"
  | "user-stories"
  | "doc-reconcile-partial";

export interface GenerateJobData {
  type: GenerateJobType;
  projectId: string;
  userId?: string;
  preview?: boolean;
  gapsFeedback?: string | null;
  target?: string;
  forceRegenerate?: boolean;
  gapId?: string;
  stageId?: string;
  affectedArtifacts?: AffectedArtifact[];
  /** Si true, permite generar aunque el gate MDD tenga blockers (soft gate). */
  acknowledgeGaps?: boolean;
}

/** Estado público de un job para polling del frontend. */
export interface GenerateJobStatus {
  jobId: string;
  projectId?: string;
  type: GenerateJobType | null;
  status: "queued" | "active" | "completed" | "failed" | "retrying" | "unknown";
  progress: unknown;
  result?: unknown;
  error?: string;
  attemptsMade: number;
  maxAttempts: number;
  createdAt: number;
  finishedAt?: number;
}

type InMemoryJobRecord = {
  data: GenerateJobData;
  status: GenerateJobStatus["status"];
  progress: unknown;
  result?: unknown;
  error?: string;
  createdAt: number;
  finishedAt?: number;
};

/**
 * Determina si un error es transitorio para loggear apropiadamente.
 * BullMQ ya maneja el retry via `backoff` en defaultJobOptions.
 */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("ehostunreach") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up") ||
    msg.includes("api connection error")
  );
}

@Injectable()
export class DeliverablesQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliverablesQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private readonly inMemoryJobs = new Map<string, InMemoryJobRecord>();

  /** Intentos máximos por job (BullMQ reintenta automáticamente con backoff). */
  private readonly MAX_ATTEMPTS = 4;

  constructor(
    @Inject(forwardRef(() => ProjectsService))
    private readonly projects: ProjectsService,
    @Optional()
    @Inject(forwardRef(() => DocReconcileService))
    private readonly docReconcile: DocReconcileService | null,
  ) {}

  /** Cola disponible (BullMQ con Redis o fallback in-memory en dev). */
  isEnabled(): boolean {
    return true;
  }

  usesRedis(): boolean {
    return !!process.env.REDIS_URL?.trim();
  }

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.logger.log(
        "BullMQ: sin REDIS_URL — cascada de entregables usa cola in-memory (polling + progreso en chat)",
      );
      return;
    }
    this.queue = new Queue(DELIVERABLES_QUEUE_NAME, {
      connection: { url },
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86_400, count: 40 },
        attempts: this.MAX_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: 4_000,
        },
      },
    });
    this.worker = new Worker(
      DELIVERABLES_QUEUE_NAME,
      async (job: Job<GenerateJobData>) => {
        const { userId } = job.data;
        return runWithRequestUserAsync(userId ?? "system", async () => {
          this.logger.log(
            `BullMQ worker: iniciando job ${job.id} type=${job.data.type} projectId=${job.data.projectId} attempt=${job.attemptsMade + 1}/${this.MAX_ATTEMPTS}`,
          );
          job.updateProgress(0);
          return this.runJob(job.data, (p) => job.updateProgress(p as Job["progress"]));
        });
      },
      {
        connection: { url },
        concurrency: 2,
      },
    );
    this.worker.on("failed", (job, err) => {
      const data = job?.data as GenerateJobData | undefined;
      const transient = isTransientError(err);
      this.logger.error(
        `BullMQ job ${job?.id} (${data?.type ?? "?"} projectId=${data?.projectId ?? "?"}) ` +
          `${transient ? "falló (transitorio, reintentando...)" : "falló definitivamente"}: ${err instanceof Error ? err.message : err}`,
      );
    });
    this.worker.on("completed", (job) => {
      const data = job.data as GenerateJobData | undefined;
      const elapsed = job.finishedOn && job.processedOn ? Math.round((job.finishedOn - job.processedOn) / 1000) : 0;
      this.logger.log(`BullMQ job ${job.id} (${data?.type ?? "?"}) completado en ${elapsed}s`);
    });
    this.logger.log(
      `BullMQ worker activo (${DELIVERABLES_QUEUE_NAME}), maxAttempts=${this.MAX_ATTEMPTS}, concurrency=2, backoff=exponential/4s`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async runJob(data: GenerateJobData, onProgress: (p: unknown) => void): Promise<unknown> {
    const {
      type,
      projectId,
      preview,
      gapsFeedback,
      target,
      forceRegenerate,
      gapId,
      stageId,
      affectedArtifacts,
      acknowledgeGaps,
    } = data;

    if (!preview && type !== "doc-reconcile-partial") {
      await this.projects.assertDeliverablesAllowed(projectId, { acknowledgeGaps });
    }

    let result: unknown;
    switch (type) {
      case "cascade":
        result = await this.projects.generateDeliverablesCascade(
          projectId,
          (p) => {
            onProgress(p);
          },
          { acknowledgeGaps },
        );
        break;
      case "blueprint":
        if (preview) {
          result = await this.projects.generateBlueprintPreview(projectId, gapsFeedback);
        } else {
          result = await this.projects.generateBlueprint(projectId, gapsFeedback);
        }
        break;
      case "api-contracts":
        if (preview) {
          result = await this.projects.generateApiContractsPreview(projectId, gapsFeedback);
        } else {
          result = await this.projects.generateApiContracts(projectId, gapsFeedback);
        }
        break;
      case "logic-flows":
        result = await this.projects.generateLogicFlows(projectId, gapsFeedback);
        break;
      case "tasks":
        result = await this.projects.generateTasks(projectId);
        break;
      case "agent-governance":
        if (preview) {
          result = await this.projects.generateAgentGovernancePreview(projectId, target, {
            forceRegenerate: forceRegenerate !== false,
          });
        } else {
          result = await this.projects.generateAgentGovernance(projectId, target, {
            forceRegenerate: forceRegenerate !== false,
          });
        }
        break;
      case "infra":
        if (preview) {
          result = await this.projects.generateInfraPreview(projectId, gapsFeedback);
        } else {
          result = await this.projects.generateInfra(projectId, gapsFeedback);
        }
        break;
      case "architecture":
        if (preview) {
          result = await this.projects.generateArchitecturePreview(projectId);
        } else {
          result = await this.projects.generateArchitecture(projectId);
        }
        break;
      case "use-cases":
        if (preview) {
          result = await this.projects.generateUseCasesPreview(projectId);
        } else {
          result = await this.projects.generateUseCases(projectId);
        }
        break;
      case "user-stories":
        if (preview) {
          result = await this.projects.generateUserStoriesPreview(projectId);
        } else {
          result = await this.projects.generateUserStories(projectId);
        }
        break;
      case "doc-reconcile-partial": {
        if (!this.docReconcile || !gapId || !stageId || !affectedArtifacts?.length) {
          throw new Error("doc-reconcile-partial requiere DocReconcileService, gapId, stageId y affectedArtifacts");
        }
        result = await this.docReconcile.executeReconcile({
          projectId,
          stageId,
          gapId,
          affectedArtifacts,
          gapsFeedback: gapsFeedback ?? "",
        });
        break;
      }
      default:
        throw new Error(`Tipo de job desconocido: ${type}`);
    }

    if (
      type !== "cascade" &&
      type !== "doc-reconcile-partial" &&
      type !== "agent-governance" &&
      !preview
    ) {
      await this.projects.runPostRegenSddConflictSurfacing(projectId).catch((err) => {
        this.logger.warn(
          `[deliverables-queue] sddConflictSurfacing (${type}): ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return result;
  }

  private startInMemoryJob(jobId: string, data: GenerateJobData): void {
    const record = this.inMemoryJobs.get(jobId);
    if (!record) return;
    record.status = "active";

    void runWithRequestUserAsync(data.userId ?? "system", async () => {
      const started = Date.now();
      try {
        const result = await this.runJob(data, (p) => {
          record.progress = p;
        });
        record.status = "completed";
        record.result = result;
        record.finishedAt = Date.now();
        const elapsed = Math.round((Date.now() - started) / 1000);
        this.logger.log(
          `In-memory job ${jobId} (${data.type} projectId=${data.projectId}) completado en ${elapsed}s`,
        );
      } catch (err) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : String(err);
        record.finishedAt = Date.now();
        this.logger.error(
          `In-memory job ${jobId} (${data.type} projectId=${data.projectId}) falló: ${record.error}`,
        );
      }
    });
  }

  /** Encola cualquier tipo de job de generación. Retorna jobId. */
  async enqueue(data: GenerateJobData): Promise<string> {
    const userId = data.userId ?? getRequestUserId();
    const payload: GenerateJobData = { ...data, userId };

    if (this.queue) {
      const job = await this.queue.add(data.type, payload);
      return String(job.id);
    }

    const jobId = randomUUID();
    this.inMemoryJobs.set(jobId, {
      data: payload,
      status: "queued",
      progress: 0,
      createdAt: Date.now(),
    });
    this.logger.log(`In-memory job ${jobId} encolado type=${data.type} projectId=${data.projectId}`);
    setImmediate(() => this.startInMemoryJob(jobId, payload));
    return jobId;
  }

  /** Devuelve el estado público de un job para polling del frontend. */
  async getJobStatus(jobId: string): Promise<GenerateJobStatus> {
    const mem = this.inMemoryJobs.get(jobId);
    if (mem) {
      return {
        jobId,
        projectId: mem.data.projectId,
        type: mem.data.type,
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
      return { jobId, type: null, status: "unknown", progress: 0, attemptsMade: 0, maxAttempts: this.MAX_ATTEMPTS, createdAt: 0 };
    }
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return { jobId, type: null, status: "unknown", progress: 0, attemptsMade: 0, maxAttempts: this.MAX_ATTEMPTS, createdAt: 0 };
    }

    const data = job.data as GenerateJobData | undefined;
    const state = await job.getState();

    let status: GenerateJobStatus["status"];
    if (state === "completed") status = "completed";
    else if (state === "failed") {
      status = job.attemptsMade < (job.opts?.attempts ?? 1) ? "retrying" : "failed";
    } else if (state === "active") status = "active";
    else if (state === "delayed") status = "retrying";
    else if (state === "waiting" || state === "waiting-children") status = "queued";
    else status = "unknown";

    return {
      jobId,
      projectId: data?.projectId,
      type: data?.type ?? null,
      status,
      progress: job.progress ?? 0,
      result: job.returnvalue ?? undefined,
      error: job.failedReason ?? undefined,
      attemptsMade: job.attemptsMade,
      maxAttempts: this.MAX_ATTEMPTS,
      createdAt: job.timestamp ?? Date.now(),
      finishedAt: job.finishedOn ?? undefined,
    };
  }
}
