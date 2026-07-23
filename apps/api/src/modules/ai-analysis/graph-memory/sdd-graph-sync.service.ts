import { Injectable, Logger } from "@nestjs/common";
import {
  mddGraphFingerprint,
  resolveSddGraphSyncState,
  type SddGraphSyncStatus,
} from "@theforge/shared-types";
import { GraphMemoryService } from "./graph-memory.service.js";
import { parseMddGraphExpectations } from "./sdd-graph-expectations.util.js";

export type SddGraphSnapshotContext = {
  lastSyncedAt?: number | null;
  mddFingerprint?: string | null;
};

@Injectable()
export class SddGraphSyncService {
  private readonly logger = new Logger(SddGraphSyncService.name);

  constructor(private readonly graphMemory: GraphMemoryService) {}

  isFalkorAvailable(): boolean {
    return this.graphMemory.isConnected();
  }

  /** Sincroniza MDD → Falkor y devuelve estado post-sync (await; usar antes del semáforo). */
  async syncMddAndEvaluate(
    projectId: string,
    stageId: string,
    mddMarkdown: string,
  ): Promise<SddGraphSyncStatus> {
    const expectations = parseMddGraphExpectations(mddMarkdown);
    const fingerprint = mddGraphFingerprint(mddMarkdown);
    if (!this.graphMemory.isConnected()) {
      return resolveSddGraphSyncState({
        falkorAvailable: false,
        expectedEntities: expectations.expectedEntities,
        expectedEndpoints: expectations.expectedEndpoints,
        graphEntities: 0,
        graphEndpoints: 0,
        isCoherent: null,
      });
    }

    try {
      await this.graphMemory.syncMddToGraph(projectId, stageId, expectations.structured, {
        mddFingerprint: fingerprint,
      });
      const health = await this.graphMemory.evaluateSddDependencyHealth(projectId, stageId);
      const snapshot = await this.graphMemory.getSddStageSnapshot(projectId, stageId);
      const status = resolveSddGraphSyncState({
        falkorAvailable: true,
        expectedEntities: expectations.expectedEntities,
        expectedEndpoints: expectations.expectedEndpoints,
        graphEntities: snapshot?.entityNames.length ?? health?.entityCount ?? 0,
        graphEndpoints: snapshot?.endpoints.length ?? health?.endpointCount ?? 0,
        isCoherent: health?.isCoherent ?? null,
        orphanEntityCount: health?.orphanEntityCount ?? 0,
        orphanEndpointCount: health?.orphanEndpointCount ?? 0,
      });
      return {
        ...status,
        lastSyncedAt: Date.now(),
      };
    } catch (err) {
      this.logger.warn(
        `[SddGraphSync] sync failed project=${projectId} stage=${stageId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return resolveSddGraphSyncState({
        falkorAvailable: false,
        expectedEntities: expectations.expectedEntities,
        expectedEndpoints: expectations.expectedEndpoints,
        graphEntities: 0,
        graphEndpoints: 0,
        isCoherent: null,
      });
    }
  }

  /** Evalúa estado sin re-ingestar (para polling generation-status). */
  async evaluateFromMdd(
    projectId: string,
    stageId: string,
    mddMarkdown: string,
    context?: SddGraphSnapshotContext | null,
  ): Promise<SddGraphSyncStatus> {
    const expectations = parseMddGraphExpectations(mddMarkdown);
    const fingerprint = mddGraphFingerprint(mddMarkdown);
    const mddChangedSinceSync =
      Boolean(context?.mddFingerprint) && context!.mddFingerprint !== fingerprint;

    if (!this.graphMemory.isConnected()) {
      return resolveSddGraphSyncState({
        falkorAvailable: false,
        expectedEntities: expectations.expectedEntities,
        expectedEndpoints: expectations.expectedEndpoints,
        graphEntities: 0,
        graphEndpoints: 0,
        isCoherent: null,
      });
    }

    const health = await this.graphMemory.evaluateSddDependencyHealth(projectId, stageId);
    const snapshot = await this.graphMemory.getSddStageSnapshot(projectId, stageId);
    const graphEntities = snapshot?.entityNames.length ?? health?.entityCount ?? 0;
    const graphEndpoints = snapshot?.endpoints.length ?? health?.endpointCount ?? 0;

    const status = resolveSddGraphSyncState({
      falkorAvailable: true,
      expectedEntities: expectations.expectedEntities,
      expectedEndpoints: expectations.expectedEndpoints,
      graphEntities,
      graphEndpoints,
      isCoherent: health?.isCoherent ?? null,
      orphanEntityCount: health?.orphanEntityCount ?? 0,
      orphanEndpointCount: health?.orphanEndpointCount ?? 0,
      mddChangedSinceSync,
    });

    return {
      ...status,
      lastSyncedAt: context?.lastSyncedAt ?? null,
    };
  }
}
