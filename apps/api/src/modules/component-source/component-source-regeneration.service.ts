import { EventEmitter } from "node:events";
import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AiAnalysisService } from "../ai-analysis/ai-analysis.service.js";
import { fetchFullDesignSystemFromPort } from "./component-source-design-system.util.js";
import { applyDesignSystemMcpToProjectDocs } from "./sync-design-system-doc-section.util.js";
import { ComponentSourceRegenerationQueueService } from "./component-source-regeneration-queue.service.js";
import { ComponentSourceRegistry } from "./component-source.registry.js";
import { parseToolMappingFromJson } from "./parse-tool-mapping.util.js";

export type RegenerationProgressEvent = {
  type: "progress";
  step: number;
  totalSteps: number;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
  durationMs?: number;
  projectId: string;
  profileId: string;
};

export type RegenerationTerminalEvent =
  | { type: "done"; projectId: string; profileId: string }
  | { type: "error"; message: string; projectId: string; profileId: string };

export type RegenerationEvent = RegenerationProgressEvent | RegenerationTerminalEvent;

export interface RegenerationJobData {
  projectId: string;
  profileId: string;
  userId: string;
}

interface PersistedRegenerationState {
  jobId: string;
  projectId: string;
  profileId: string;
  events: RegenerationEvent[];
  status: "running" | "done" | "error";
  updatedAt: number;
}

const REDIS_EVENTS_CHANNEL_PREFIX = "theforge:component-source-regeneration:events:";
const REDIS_STATE_KEY_PREFIX = "theforge:component-source-regeneration:state:";
const REDIS_STATE_TTL_SECONDS = 3600;

@Injectable()
export class ComponentSourceRegenerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ComponentSourceRegenerationService.name);
  private readonly emitters = new Map<string, EventEmitter>();
  private readonly activeJobs = new Map<string, RegenerationJobData>();
  private readonly redisListenerCounts = new Map<string, number>();

  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ComponentSourceRegistry,
    @Inject(forwardRef(() => AiAnalysisService))
    private readonly aiAnalysis: AiAnalysisService,
    @Inject(forwardRef(() => ComponentSourceRegenerationQueueService))
    private readonly queue: ComponentSourceRegenerationQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL?.trim();
    if (!url) return;

    this.publisher = new Redis(url, { maxRetriesPerRequest: null });
    this.subscriber = new Redis(url, { maxRetriesPerRequest: null });
    this.subscriber.on("message", (channel, message) => {
      const userId = channel.slice(REDIS_EVENTS_CHANNEL_PREFIX.length);
      if (!userId) return;
      try {
        const event = JSON.parse(message) as RegenerationEvent;
        this.getOrCreateEmitter(userId).emit("event", event);
      } catch {
        this.logger.warn(`Evento regeneración inválido en canal ${channel}`);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    await this.publisher?.quit();
  }

  async getReplayEvents(userId: string): Promise<RegenerationEvent[]> {
    if (!this.publisher) return [];
    const raw = await this.publisher.get(this.stateKey(userId));
    if (!raw) return [];
    try {
      const state = JSON.parse(raw) as PersistedRegenerationState;
      return state.events ?? [];
    } catch {
      return [];
    }
  }

  subscribe(userId: string, listener: (event: RegenerationEvent) => void): () => void {
    const emitter = this.getOrCreateEmitter(userId);
    emitter.on("event", listener);
    void this.ensureRedisSubscription(userId);

    return () => {
      emitter.off("event", listener);
      void this.releaseRedisSubscription(userId);
    };
  }

  async hasActiveJob(userId: string): Promise<boolean> {
    if ([...this.activeJobs.values()].some((job) => job.userId === userId)) return true;
    if (this.publisher) {
      const raw = await this.publisher.get(this.stateKey(userId));
      if (raw) {
        try {
          const state = JSON.parse(raw) as PersistedRegenerationState;
          if (state.status === "running") return true;
        } catch {
          /* ignore */
        }
      }
    }
    if (this.queue.isEnabled()) {
      return this.queue.hasActiveJobForUser(userId);
    }
    return false;
  }

  enqueueProjectProfileChange(
    projectId: string,
    profileId: string | null,
    userId: string,
    previousProfileId: string | null,
  ): void {
    if (!profileId || profileId === previousProfileId) return;

    const job: RegenerationJobData = { projectId, profileId, userId };
    if (this.queue.isEnabled()) {
      void this.queue.enqueue(job);
      return;
    }
    void this.runJobInProcess(job);
  }

  async publishTerminalError(
    userId: string,
    projectId: string,
    profileId: string,
    message: string,
  ): Promise<void> {
    await this.publishEvent(userId, { type: "error", message, projectId, profileId }, `${projectId}:${profileId}`);
  }

  async executeJob(
    job: RegenerationJobData,
    onProgress?: (event: RegenerationEvent) => void,
  ): Promise<void> {
    const jobKey = `${job.projectId}:${job.profileId}`;
    const { projectId, profileId, userId } = job;
    const started = Date.now();

    const emitProgress = async (
      step: number,
      totalSteps: number,
      label: string,
      status: RegenerationProgressEvent["status"],
      detail?: string,
    ) => {
      const event: RegenerationProgressEvent = {
        type: "progress",
        step,
        totalSteps,
        label,
        status,
        detail,
        durationMs: Date.now() - started,
        projectId,
        profileId,
      };
      onProgress?.(event);
      await this.publishEvent(userId, event, jobKey);
    };

    try {
      const profile = await this.prisma.componentSourceProfile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          userId: true,
          toolMapping: true,
          capabilities: true,
          mappingConfirmedAt: true,
        },
      });
      if (!profile || profile.userId !== userId) {
        await this.publishEvent(
          userId,
          {
            type: "error",
            message: "Perfil no encontrado para regeneración",
            projectId,
            profileId,
          },
          jobKey,
        );
        return;
      }

      await this.initPersistedState(jobKey, job);

      const mapping = parseToolMappingFromJson(profile.toolMapping);
      const hasDesignSystem = Boolean(mapping?.["designSystem.get"]?.toolName?.trim());
      /** dsOnly wireframe pipeline emits 2 node steps (+ save reuses step 2). */
      const wireframePipelineSteps = 2;
      const dsStepOffset = hasDesignSystem ? 1 : 0;
      const totalSteps = dsStepOffset + wireframePipelineSteps;
      let step = 0;

      if (hasDesignSystem) {
        step += 1;
        await emitProgress(step, totalSteps, "Importando design system", "running");
        try {
          const sourceCtx = await this.registry.resolveForProject(projectId);
          if (sourceCtx.active) {
            const payload = await fetchFullDesignSystemFromPort(sourceCtx.port, sourceCtx.ownerUserId);
            const projectRow = await this.prisma.project.findUnique({
              where: { id: projectId },
              select: {
                componentSourceProfile: { select: { name: true } },
                stages: {
                  orderBy: { ordinal: "asc" },
                  take: 1,
                  select: { id: true, mddContent: true, brdContent: true },
                },
              },
            });
            const mainStage = projectRow?.stages[0];
            const docSync = applyDesignSystemMcpToProjectDocs({
              designMd: payload.designMd,
              tokens: payload.tokens,
              meta: payload.meta,
              profileName: projectRow?.componentSourceProfile?.name,
              mddContent: mainStage?.mddContent,
              brdContent: mainStage?.brdContent,
            });
            await this.prisma.project.update({
              where: { id: projectId },
              data: { uxUiGuideContent: payload.designMd },
            });
            if (mainStage) {
              const stageData: { mddContent?: string; brdContent?: string } = {};
              if (docSync.mddContent !== undefined) stageData.mddContent = docSync.mddContent;
              if (docSync.brdContent !== undefined) stageData.brdContent = docSync.brdContent;
              if (Object.keys(stageData).length > 0) {
                await this.prisma.stage.update({
                  where: { id: mainStage.id },
                  data: stageData,
                });
              }
            }
            const detail =
              docSync.target === "mdd"
                ? "Guía UX/UI + sección MCP en MDD"
                : docSync.target === "brd"
                  ? "Guía UX/UI + sección MCP en BRD"
                  : "Guía UX/UI actualizada";
            await emitProgress(step, totalSteps, "Importando design system", "done", detail);
          } else {
            await emitProgress(
              step,
              totalSteps,
              "Importando design system",
              "error",
              "Perfil MCP inactivo",
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await emitProgress(step, totalSteps, "Importando design system", "error", message);
        }
      }

      try {
        let wireframeDone = false;
        let wireframeError: string | undefined;
        let lastProgress: { step: number; totalSteps: number; label: string } | null = null;

        for await (const event of this.aiAnalysis.streamWireframes(projectId, { dsOnly: true })) {
          if (event.type === "progress") {
            const regenStep = event.step + dsStepOffset;
            const regenTotalSteps = event.totalSteps + dsStepOffset;
            lastProgress = { step: regenStep, totalSteps: regenTotalSteps, label: event.label };
            await emitProgress(
              regenStep,
              regenTotalSteps,
              event.label,
              event.status,
              event.detail,
            );
            continue;
          }
          if (event.type === "error") {
            wireframeError = event.message;
            this.logger.error(
              `[Regeneration] wireframes dsOnly failed project=${projectId}: ${event.message}`,
            );
            if (lastProgress) {
              await emitProgress(
                lastProgress.step,
                lastProgress.totalSteps,
                lastProgress.label,
                "error",
                event.message,
              );
            } else {
              await emitProgress(
                1 + dsStepOffset,
                totalSteps,
                "Re-mapeando componentes (DS)",
                "error",
                event.message,
              );
            }
            break;
          }
          if (event.type === "done") {
            wireframeDone = true;
            break;
          }
        }
        if (wireframeError) {
          await this.publishEvent(
            userId,
            { type: "error", message: wireframeError, projectId, profileId },
            jobKey,
          );
          return;
        }
        if (!wireframeDone) {
          this.logger.warn(
            `[Regeneration] wireframes dsOnly ended without done project=${projectId}`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await emitProgress(
          1 + dsStepOffset,
          totalSteps,
          "Re-mapeando componentes (DS)",
          "error",
          message,
        );
        await this.publishEvent(userId, { type: "error", message, projectId, profileId }, jobKey);
        return;
      }

      await this.publishEvent(userId, { type: "done", projectId, profileId }, jobKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Regeneration job failed project=${projectId}: ${message}`);
      if (!this.queue.isEnabled()) {
        await this.publishEvent(userId, { type: "error", message, projectId, profileId }, jobKey);
      }
      throw err;
    }
  }

  private async runJobInProcess(job: RegenerationJobData): Promise<void> {
    const jobKey = `${job.projectId}:${job.profileId}`;
    if (this.activeJobs.has(jobKey)) return;
    this.activeJobs.set(jobKey, job);
    try {
      await this.executeJob(job);
    } finally {
      this.activeJobs.delete(jobKey);
    }
  }

  private getOrCreateEmitter(userId: string): EventEmitter {
    let emitter = this.emitters.get(userId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(20);
      this.emitters.set(userId, emitter);
    }
    return emitter;
  }

  private stateKey(userId: string): string {
    return `${REDIS_STATE_KEY_PREFIX}${userId}`;
  }

  private eventsChannel(userId: string): string {
    return `${REDIS_EVENTS_CHANNEL_PREFIX}${userId}`;
  }

  private async ensureRedisSubscription(userId: string): Promise<void> {
    if (!this.subscriber) return;
    const count = (this.redisListenerCounts.get(userId) ?? 0) + 1;
    this.redisListenerCounts.set(userId, count);
    if (count === 1) {
      await this.subscriber.subscribe(this.eventsChannel(userId));
    }
  }

  private async releaseRedisSubscription(userId: string): Promise<void> {
    if (!this.subscriber) return;
    const count = (this.redisListenerCounts.get(userId) ?? 0) - 1;
    if (count <= 0) {
      this.redisListenerCounts.delete(userId);
      await this.subscriber.unsubscribe(this.eventsChannel(userId));
      return;
    }
    this.redisListenerCounts.set(userId, count);
  }

  private async initPersistedState(jobId: string, job: RegenerationJobData): Promise<void> {
    if (!this.publisher) return;
    const state: PersistedRegenerationState = {
      jobId,
      projectId: job.projectId,
      profileId: job.profileId,
      events: [],
      status: "running",
      updatedAt: Date.now(),
    };
    await this.publisher.set(
      this.stateKey(job.userId),
      JSON.stringify(state),
      "EX",
      REDIS_STATE_TTL_SECONDS,
    );
  }

  async publishEvent(
    userId: string,
    event: RegenerationEvent,
    jobId: string,
  ): Promise<void> {
    if (!this.publisher) {
      this.getOrCreateEmitter(userId).emit("event", event);
      return;
    }

    const key = this.stateKey(userId);
    const raw = await this.publisher.get(key);
    let state: PersistedRegenerationState;
    if (raw) {
      try {
        state = JSON.parse(raw) as PersistedRegenerationState;
      } catch {
        state = {
          jobId,
          projectId: event.projectId,
          profileId: event.profileId,
          events: [],
          status: "running",
          updatedAt: Date.now(),
        };
      }
    } else {
      state = {
        jobId,
        projectId: event.projectId,
        profileId: event.profileId,
        events: [],
        status: "running",
        updatedAt: Date.now(),
      };
    }

    if (event.type === "progress") {
      const idx = state.events.findIndex(
        (e) => e.type === "progress" && e.step === event.step,
      );
      if (idx >= 0) state.events[idx] = event;
      else state.events.push(event);
    } else {
      state.events.push(event);
      state.status = event.type === "done" ? "done" : "error";
    }
    state.updatedAt = Date.now();

    await this.publisher
      .multi()
      .set(key, JSON.stringify(state), "EX", REDIS_STATE_TTL_SECONDS)
      .publish(this.eventsChannel(userId), JSON.stringify(event))
      .exec();
  }
}
