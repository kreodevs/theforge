import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import {
  resolvePlatformConfigBoolean,
  resolvePlatformConfigByKey,
  resolvePlatformConfigNumber,
} from "../system-config/platform-config.runtime.js";

/**
 * Caché en memoria del contexto MCP/TheForge por proyecto y huella del índice
 * (equiv. a “revisión” del código sin depender del git hash del repo remoto).
 * Opcional: `theforge_context_revision` para invalidar manualmente tras deploy del índice.
 */
@Injectable()
export class TheForgeContextCacheService {
  private readonly logger = new Logger(TheForgeContextCacheService.name);
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  isEnabled(): boolean {
    return resolvePlatformConfigBoolean("theforge_context_cache");
  }

  private ttlMs(): number {
    return Math.max(60_000, resolvePlatformConfigNumber("theforge_context_cache_ttl_ms"));
  }

  private maxEntries(): number {
    return Math.max(8, resolvePlatformConfigNumber("theforge_context_cache_max_entries"));
  }

  cacheKey(projectId: string, fingerprint: string): string {
    const revision = resolvePlatformConfigByKey("theforge_context_revision").trim();
    return `${projectId}\n${revision}\n${fingerprint}`;
  }

  fingerprintFromSemanticSlice(projectId: string, semanticText: string): string {
    const revision = resolvePlatformConfigByKey("theforge_context_revision").trim();
    return createHash("sha256")
      .update(projectId)
      .update("\0")
      .update(revision)
      .update("\0")
      .update(semanticText.slice(0, 24_000))
      .digest("hex");
  }

  /** Huella fija para contexto vía MCP `generate_legacy_documentation` (invalidar con `theforge_context_revision`). */
  legacyDocumentationFingerprint(): string {
    return "generate_legacy_documentation_v2_multi_repo";
  }

  get(key: string): string | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: string): void {
    const maxEntries = this.maxEntries();
    while (this.store.size >= maxEntries) {
      const first = this.store.keys().next().value;
      if (first === undefined) break;
      this.store.delete(first);
    }
    const ttlMs = this.ttlMs();
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.logger.debug(`[TheForgeContextCache] set key=${key.slice(0, 48)}… ttlMs=${ttlMs}`);
  }
}
