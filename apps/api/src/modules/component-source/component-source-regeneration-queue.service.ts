import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker, type Job } from "bullmq";
import { runWithRequestUserAsync } from "../../common/request-user.store.js";
import {
  ComponentSourceRegenerationService,
  type RegenerationJobData,
} from "./component-source-regeneration.service.js";

export const COMPONENT_SOURCE_REGENERATION_QUEUE_NAME = "component-source-regeneration";

@Injectable()
export class ComponentSourceRegenerationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComponentSourceRegenerationQueueService.name);
  private queue: Queue<RegenerationJobData> | null = null;
  private worker: Worker<RegenerationJobData> | null = null;

  /** 1 intento inicial + 2 reintentos. */
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    @Inject(forwardRef(() => ComponentSourceRegenerationService))
    private readonly regeneration: ComponentSourceRegenerationService,
  ) {}

  isEnabled(): boolean {
    return !!process.env.REDIS_URL?.trim();
  }

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.logger.log(
        "BullMQ: sin REDIS_URL — regeneración MCP sigue en memoria (sin persistencia entre reinicios)",
      );
      return;
    }

    this.queue = new Queue<RegenerationJobData>(COMPONENT_SOURCE_REGENERATION_QUEUE_NAME, {
      connection: { url },
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 50 },
        removeOnFail: { age: 86_400, count: 20 },
        attempts: this.MAX_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: 4_000,
        },
      },
    });

    this.worker = new Worker<RegenerationJobData>(
      COMPONENT_SOURCE_REGENERATION_QUEUE_NAME,
      async (job: Job<RegenerationJobData>) => {
        const { projectId, profileId, userId } = job.data;
        return runWithRequestUserAsync(userId, async () => {
          this.logger.log(
            `BullMQ worker: regeneración ${job.id} projectId=${projectId} profileId=${profileId} ` +
              `attempt=${job.attemptsMade + 1}/${this.MAX_ATTEMPTS}`,
          );
          await this.regeneration.executeJob(job.data, (event) => {
            void job.updateProgress(event);
          });
        });
      },
      {
        connection: { url },
        concurrency: 1,
      },
    );

    this.worker.on("failed", (job, err) => {
      const data = job?.data;
      const message = err instanceof Error ? err.message : String(err);
      const exhausted =
        !!job && job.attemptsMade >= (job.opts?.attempts ?? this.MAX_ATTEMPTS);
      this.logger.error(
        `BullMQ regeneración job ${job?.id} (projectId=${data?.projectId ?? "?"}) ` +
          `${exhausted ? "falló definitivamente" : "falló (reintentando...)"}: ${message}`,
      );
      if (exhausted && data) {
        void this.regeneration.publishTerminalError(
          data.userId,
          data.projectId,
          data.profileId,
          message,
        );
      }
    });

    this.worker.on("completed", (job) => {
      const data = job.data;
      const elapsed =
        job.finishedOn && job.processedOn
          ? Math.round((job.finishedOn - job.processedOn) / 1000)
          : 0;
      this.logger.log(
        `BullMQ regeneración job ${job.id} (projectId=${data.projectId}) completado en ${elapsed}s`,
      );
    });

    this.logger.log(
      `BullMQ worker activo (${COMPONENT_SOURCE_REGENERATION_QUEUE_NAME}), ` +
        `maxAttempts=${this.MAX_ATTEMPTS}, concurrency=1, backoff=exponential/4s`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(data: RegenerationJobData): Promise<string | null> {
    if (!this.queue) return null;

    const jobId = `${data.projectId}:${data.profileId}`;
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "active" || state === "waiting" || state === "delayed") {
        return jobId;
      }
    }

    const job = await this.queue.add("regenerate", data, { jobId });
    return String(job.id);
  }

  async hasActiveJobForUser(userId: string): Promise<boolean> {
    if (!this.queue) return false;

    const states = ["active", "waiting", "delayed"] as const;
    for (const state of states) {
      const jobs = await this.queue.getJobs([state], 0, 100);
      if (jobs.some((job) => job.data.userId === userId)) return true;
    }
    return false;
  }
}
