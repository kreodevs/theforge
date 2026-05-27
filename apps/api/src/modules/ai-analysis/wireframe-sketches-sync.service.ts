import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AIFactory } from "../ai/ai.factory.js";
import { pickPrimaryStage } from "../projects/stage-helpers.js";
import { createWireframeSketchLLMFromRuntime } from "./llm/create-dbga-llm.js";
import {
  loadProjectWireframesRow,
  readWireframesSketchesCacheRaw,
  writeWireframesSketchesCacheRaw,
} from "./wireframe-sketches-cache.store.js";
import {
  SKETCH_LLM_BATCH_SIZE,
  buildSketchesCachePayloadV2,
  cacheToSketchList,
  contentDigestHash,
  generateAllScreenSketches,
  matchSketchToSection,
  normalizeScreenCacheKey,
  parseWireframeScreensFromMarkdown,
  readSketchesCacheV2,
  resolveScreensToRegenerate,
} from "./utils/wireframe-screen-sketch.util.js";
import { prepareDesignSystemContextForWireframes } from "./utils/wireframe-design-system-context.util.js";

export type SyncWireframeSketchesOptions = {
  forceAll?: boolean;
  mddChanged?: boolean;
  /** Regenera solo estas pantallas; el resto se conserva en caché. */
  screenNames?: string[];
};

export type SyncWireframeSketchesResult = {
  screenSketches: Array<{ screenName: string; html: string }>;
  sketchesStale: boolean;
  debug?: {
    parsedSections: number;
    withWireframe: number;
    toGenerate: number;
    keptFromCache: number;
    llmGenerated: number;
    savedToCache: number;
    forceAll: boolean;
    cacheVersion: number | null;
    batches: Array<{ index: number; expected: number; parsed: number; rawLength: number }>;
    error?: string;
  };
};

@Injectable()
export class WireframeSketchesSyncService {
  private readonly logger = new Logger(WireframeSketchesSyncService.name);
  /** Evita sync duplicados y permite polling de estado. */
  private readonly inFlight = new Map<string, Promise<SyncWireframeSketchesResult>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AIFactory,
  ) {}

  isSyncInFlight(projectId: string): boolean {
    const pid = projectId?.trim();
    return pid ? this.inFlight.has(pid) : false;
  }

  private log(step: string, detail: Record<string, unknown>) {
    this.logger.log(`[SketchSync] ${step} ${JSON.stringify(detail)}`);
  }

  private async resolveMddHash(projectId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        stages: {
          orderBy: { ordinal: "asc" },
          select: { mddContent: true, ordinal: true, workflowStatus: true },
        },
      },
    });
    const mdd = pickPrimaryStage(project?.stages ?? [])?.mddContent?.trim() ?? "";
    return contentDigestHash(mdd || "(sin-mdd)");
  }

  async syncWireframeScreenSketches(
    projectId: string,
    options?: SyncWireframeSketchesOptions,
  ): Promise<SyncWireframeSketchesResult> {
    const pid = projectId?.trim();
    if (!pid) {
      return {
        screenSketches: [],
        sketchesStale: true,
        debug: {
          parsedSections: 0,
          withWireframe: 0,
          toGenerate: 0,
          keptFromCache: 0,
          llmGenerated: 0,
          savedToCache: 0,
          forceAll: false,
          cacheVersion: null,
          batches: [],
          error: "projectId vacío",
        },
      };
    }

    const existing = this.inFlight.get(pid);
    if (existing) return existing;

    const work = this.runSyncWireframeScreenSketches(pid, options).finally(() => {
      this.inFlight.delete(pid);
    });
    this.inFlight.set(pid, work);
    return work;
  }

  /** Arranca sync en background (idempotente si ya hay uno en curso). */
  startSyncInBackground(projectId: string, options?: SyncWireframeSketchesOptions): void {
    void this.syncWireframeScreenSketches(projectId, options).catch((err) => {
      this.logger.warn(
        `[SketchSync] background failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private async runSyncWireframeScreenSketches(
    pid: string,
    options?: SyncWireframeSketchesOptions,
  ): Promise<SyncWireframeSketchesResult> {
    const debug: NonNullable<SyncWireframeSketchesResult["debug"]> = {
      parsedSections: 0,
      withWireframe: 0,
      toGenerate: 0,
      keptFromCache: 0,
      llmGenerated: 0,
      savedToCache: 0,
      forceAll: options?.forceAll === true || options?.mddChanged === true,
      cacheVersion: null,
      batches: [],
    };

    this.log("start", { projectId: pid.slice(0, 8), ...debug });

    const row = await loadProjectWireframesRow(this.prisma, pid);
    const markdown = row?.wireframesContent?.trim() ?? "";
    if (!markdown) {
      await writeWireframesSketchesCacheRaw(this.prisma, pid, null);
      return { screenSketches: [], sketchesStale: true, debug: { ...debug, error: "sin wireframesContent" } };
    }

    const mddHash = await this.resolveMddHash(pid);
    const existingCache = readSketchesCacheV2(row?.cache);
    debug.cacheVersion = existingCache?.v ?? null;
    const forceAll = debug.forceAll;
    const parsedSections = parseWireframeScreensFromMarkdown(markdown);
    debug.parsedSections = parsedSections.length;
    debug.withWireframe = parsedSections.filter((s) => s.wireframeAscii.trim().length > 10).length;

    const screenNames = (options?.screenNames ?? []).map((n) => n.trim()).filter(Boolean);
    const { toGenerate, merged } = resolveScreensToRegenerate(
      parsedSections,
      existingCache,
      mddHash,
      { forceAll, screenNames: screenNames.length > 0 ? screenNames : undefined },
    );
    debug.toGenerate = toGenerate.length;
    debug.keptFromCache = merged.size;

    this.log("plan", {
      projectId: pid.slice(0, 8),
      toGenerate: debug.toGenerate,
      keptFromCache: debug.keptFromCache,
      forceAll,
      cacheScreens: existingCache ? Object.keys(existingCache.screens).length : 0,
    });

    if (toGenerate.length === 0) {
      const payload =
        existingCache && existingCache.mddHash === mddHash
          ? existingCache
          : buildSketchesCachePayloadV2(mddHash, merged, parsedSections);
      const list = cacheToSketchList(payload);
      debug.savedToCache = list.length;
      this.log("skip-llm", { screens: list.length });
      return {
        screenSketches: list,
        sketchesStale: list.length === 0,
        debug,
      };
    }

    const uxRow = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { uxUiGuideContent: true },
    });
    const designSystemContext = prepareDesignSystemContextForWireframes(
      uxRow?.uxUiGuideContent ?? "",
    );

    let llmError: string | undefined;
    try {
      const runtime = await this.aiFactory.resolveRuntime(row!.userId);
      const llm = createWireframeSketchLLMFromRuntime(runtime);
      this.log("llm-start", {
        provider: runtime.providerId,
        model: runtime.chatModel,
        batchSize: SKETCH_LLM_BATCH_SIZE,
        screens: toGenerate.length,
        designSystemChars: designSystemContext.length,
      });

      const persistPartialCache = async () => {
        const partialPayload = buildSketchesCachePayloadV2(mddHash, merged, parsedSections);
        const writeResult = await writeWireframesSketchesCacheRaw(this.prisma, pid, partialPayload);
        if (!writeResult.ok) {
          const wErr = writeResult.error ?? "write cache failed";
          this.logger.warn(`[SketchSync] partial cache write failed: ${wErr}`);
        }
        debug.savedToCache = cacheToSketchList(partialPayload).length;
      };

      const generated = await generateAllScreenSketches(
        llm,
        toGenerate,
        (batch) => {
        debug.batches.push({
          index: batch.batchIndex,
          expected: batch.expectedCount,
          parsed: batch.parsedCount,
          rawLength: batch.rawLength,
        });
        this.log("llm-batch", {
          batch: batch.batchIndex,
          expected: batch.expectedCount,
          parsed: batch.parsedCount,
          rawLength: batch.rawLength,
        });
        if (batch.parsedCount < batch.expectedCount && batch.rawLength > 0) {
          this.logger.warn(
            `[SketchSync] batch ${batch.batchIndex} parse incompleto (${batch.parsedCount}/${batch.expectedCount})`,
          );
        }
        for (const g of batch.generated) {
          const section = matchSketchToSection(g.screenName, parsedSections);
          const key = section
            ? normalizeScreenCacheKey(section.screenName)
            : normalizeScreenCacheKey(g.screenName);
          merged.set(key, {
            screenName: section?.screenName ?? g.screenName,
            html: g.html,
          });
        }
        void persistPartialCache();
        },
        designSystemContext,
      );

      debug.llmGenerated = generated.length;
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[SketchSync] LLM failed: ${llmError}`);
      debug.error = llmError;
    }

    const payload = buildSketchesCachePayloadV2(mddHash, merged, parsedSections);
    const writeResult = await writeWireframesSketchesCacheRaw(this.prisma, pid, payload);
    if (!writeResult.ok) {
      const wErr = writeResult.error ?? "write cache failed";
      this.logger.warn(`[SketchSync] cache write failed: ${wErr}`);
      debug.error = debug.error ? `${debug.error}; ${wErr}` : wErr;
    }

    const list = cacheToSketchList(payload);
    debug.savedToCache = list.length;
    if (debug.llmGenerated > 0 && debug.savedToCache === 0) {
      this.logger.warn(
        `[SketchSync] llm ok pero caché vacía mergedKeys=${JSON.stringify([...merged.keys()].slice(0, 8))} sectionKeys=${JSON.stringify(parsedSections.slice(0, 8).map((s) => normalizeScreenCacheKey(s.screenName)))}`,
      );
    }
    this.log("done", {
      llmGenerated: debug.llmGenerated,
      savedToCache: debug.savedToCache,
      error: debug.error ?? null,
    });

    const expectedScreens = debug.withWireframe || debug.toGenerate;
    const incomplete = expectedScreens > 0 && list.length < expectedScreens;

    return {
      screenSketches: list,
      sketchesStale: list.length === 0 || !!debug.error || incomplete,
      debug,
    };
  }

  async readCachedSketches(projectId: string): Promise<{
    screenSketches: Array<{ screenName: string; html: string }>;
    sketchesStale: boolean;
    staleReason?: "mdd" | "screens" | "missing";
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { wireframesContent: true },
    });
    const markdown = project?.wireframesContent?.trim() ?? "";
    if (!markdown) {
      return { screenSketches: [], sketchesStale: false };
    }

    const cacheRaw = await readWireframesSketchesCacheRaw(this.prisma, projectId);
    const mddHash = await this.resolveMddHash(projectId);
    const sections = parseWireframeScreensFromMarkdown(markdown);
    const cache = readSketchesCacheV2(cacheRaw);
    const { toGenerate, merged } = resolveScreensToRegenerate(sections, cache, mddHash, {
      forceAll: false,
    });

    const screenSketches = cacheToSketchList(
      buildSketchesCachePayloadV2(mddHash, merged, sections),
    );

    if (cacheRaw == null || !cache) {
      return { screenSketches: [], sketchesStale: true, staleReason: "missing" };
    }
    if (cache.mddHash !== mddHash) {
      return { screenSketches, sketchesStale: true, staleReason: "mdd" };
    }
    if (toGenerate.length > 0) {
      return { screenSketches, sketchesStale: true, staleReason: "screens" };
    }
    return { screenSketches, sketchesStale: false };
  }

  scheduleSync(projectId: string, options?: SyncWireframeSketchesOptions): void {
    this.startSyncInBackground(projectId, options);
  }
}
