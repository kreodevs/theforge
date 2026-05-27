import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TokenCryptoService } from "../crypto/token-crypto.service.js";
import { parseMcpResponse } from "../theforge/mcp-http.util.js";
import type {
  CatalogHealthResult,
  ComponentCode,
  ComponentModule,
  ComponentProps,
  ComponentPreviewsBatchResult,
  ComponentPreviewItem,
  ComponentResolution,
  CompositionRecipe,
  HostedPreviewPayload,
  McpToolResult,
  ProductionSnippet,
  StyleRule,
} from "./component-mcp-client-contract.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface McpSession {
  sessionId: string;
  createdAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ComponentMcpService {
  private readonly logger = new Logger(ComponentMcpService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly sessions = new Map<string, McpSession>();
  /** Evita inicializar muchas sesiones MCP en paralelo (p. ej. preview con 28 módulos). */
  private readonly sessionInitLocks = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  // ─── public API ───────────────────────────────────────────

  async searchModules(userId: string, query: string): Promise<McpToolResult<ComponentModule[]>> {
    this.logger.log(`[ComponentMCP] search_modules userId=${userId.slice(0, 8)}… query="${query}"`);
    const result = await this.callTool<ComponentModule[]>(userId, "search_modules", { query });
    this.logger.log(`[ComponentMCP] search_modules done contentItems=${result.content?.length ?? 0}`);
    return result;
  }

  async resolveComponents(userId: string, names: string[]): Promise<McpToolResult<{ results: ComponentResolution[] }>> {
    const cacheKey = `resolveComponents:${userId}:${names.sort().join(",")}`;
    const cached = this.readCache<McpToolResult<{ results: ComponentResolution[] }>>(cacheKey);
    if (cached) {
      this.logger.log(`[ComponentMCP] resolve_components cache hit names=${names.length}`);
      return cached;
    }

    this.logger.log(`[ComponentMCP] resolve_components userId=${userId.slice(0, 8)}… names=${names.length}`);
    const result = await this.callTool<{ results: ComponentResolution[] }>(
      userId,
      "resolve_components",
      { names },
    );
    const preview = result.content?.find((c) => c.type === "text")?.text?.slice(0, 400) ?? "";
    this.logger.log(`[ComponentMCP] resolve_components done preview=${JSON.stringify(preview)}`);
    this.writeCache(cacheKey, result);
    return result;
  }

  async getComponent(
    userId: string,
    moduleId: string,
    exportName?: string,
  ): Promise<McpToolResult<ComponentCode>> {
    const cacheKey = `getComponent:${userId}:${moduleId}:${exportName ?? ""}`;
    const cached = this.readCache<McpToolResult<ComponentCode>>(cacheKey);
    if (cached) return cached;

    const result = await this.callTool<ComponentCode>(userId, "get_component", {
      moduleId,
      ...(exportName ? { exportName } : {}),
    });
    this.writeCache(cacheKey, result);
    return result;
  }

  async getProps(
    userId: string,
    moduleId: string,
    exportName?: string,
  ): Promise<McpToolResult<ComponentProps>> {
    return this.callTool<ComponentProps>(userId, "get_props", {
      moduleId,
      ...(exportName ? { exportName } : {}),
    });
  }

  async getCompositionRecipe(
    userId: string,
    moduleId: string,
  ): Promise<McpToolResult<CompositionRecipe>> {
    return this.callTool<CompositionRecipe>(userId, "get_composition_recipe", {
      moduleId,
    });
  }

  async listModules(userId: string): Promise<McpToolResult<ComponentModule[]>> {
    const cacheKey = `listModules:${userId}`;
    const cached = this.readCache<McpToolResult<ComponentModule[]>>(cacheKey);
    if (cached) {
      this.logger.log(`[ComponentMCP] list_modules cache hit userId=${userId.slice(0, 8)}…`);
      return cached;
    }

    this.logger.log(`[ComponentMCP] list_modules userId=${userId.slice(0, 8)}…`);
    const result = await this.callTool<ComponentModule[]>(userId, "list_modules", {});
    const text = result.content?.find((c) => c.type === "text")?.text ?? "";
    this.logger.log(`[ComponentMCP] list_modules done textLen=${text.length} preview=${JSON.stringify(text.slice(0, 300))}`);
    this.writeCache(cacheKey, result);
    return result;
  }

  async catalogHealth(userId: string): Promise<McpToolResult<CatalogHealthResult>> {
    return this.callTool<CatalogHealthResult>(userId, "catalog_health", {});
  }

  async getStyleRules(userId: string): Promise<McpToolResult<StyleRule[]>> {
    return this.callTool<StyleRule[]>(userId, "get_style_rules", {});
  }

  async getComponentPreview(
    userId: string,
    args: {
      moduleId: string;
      exportName?: string;
      variant?: string;
      theme?: "light" | "dark";
      mode?: "html" | "url";
    },
  ): Promise<McpToolResult<HostedPreviewPayload>> {
    return this.callTool<HostedPreviewPayload>(userId, "get_component_preview", {
      moduleId: args.moduleId,
      ...(args.exportName ? { exportName: args.exportName } : {}),
      ...(args.variant ? { variant: args.variant } : {}),
      theme: args.theme ?? "light",
      mode: args.mode ?? "html",
    });
  }

  async getComponentPreviews(
    userId: string,
    args: {
      items: ComponentPreviewItem[];
      theme?: "light" | "dark";
      mode?: "html" | "url";
    },
  ): Promise<McpToolResult<ComponentPreviewsBatchResult>> {
    this.logger.log(
      `[ComponentMCP] get_component_previews userId=${userId.slice(0, 8)}… items=${args.items.length} mode=${args.mode ?? "html"}`,
    );
    return this.callTool<ComponentPreviewsBatchResult>(userId, "get_component_previews", {
      items: args.items,
      theme: args.theme ?? "light",
      mode: args.mode ?? "html",
    });
  }

  async getProductionSnippet(
    userId: string,
    moduleId: string,
    options?: { exportName?: string; includePreviewHtml?: boolean; theme?: "light" | "dark" },
  ): Promise<McpToolResult<ProductionSnippet>> {
    const cacheKey = `getProductionSnippet:${userId}:${moduleId}:${options?.exportName ?? ""}:${options?.includePreviewHtml ?? false}`;
    const cached = this.readCache<McpToolResult<ProductionSnippet>>(cacheKey);
    if (cached) {
      this.logger.debug(`[ComponentMCP] get_production_snippet cache hit moduleId="${moduleId}"`);
      return cached;
    }

    this.logger.log(`[ComponentMCP] get_production_snippet moduleId="${moduleId}" userId=${userId.slice(0, 8)}…`);
    const result = await this.callTool<ProductionSnippet>(userId, "get_production_snippet", {
      moduleId,
      ...(options?.exportName ? { exportName: options.exportName } : {}),
      ...(options?.includePreviewHtml ? { includePreviewHtml: true } : {}),
      ...(options?.theme ? { theme: options.theme } : {}),
    });
    const text = result.content?.find((c) => c.type === "text")?.text ?? "";
    const isErrorJson = text.trim().startsWith("{") && text.includes('"error"');
    this.logger.log(
      `[ComponentMCP] get_production_snippet done moduleId="${moduleId}" len=${text.length} isErrorJson=${isErrorJson}`,
    );
    this.writeCache(cacheKey, result);
    return result;
  }

  /**
   * Quick connectivity check that doesn't require an MCP session.
   * Hits `GET <mcpUrl>/health` and returns the JSON body.
   */
  async checkHealth(userId: string): Promise<{ ok: boolean; service?: string; error?: string }> {
    const { url, token } = await this.resolveCredentials(userId);
    const healthUrl = url.replace(/\/mcp\/?$/, "/health").replace(/\/+$/, "");
    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
      }
      const raw = await res.text();
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        return { ok: true, service: typeof data.service === "string" ? data.service : undefined };
      } catch {
        const trimmed = raw.trim().toLowerCase();
        if (trimmed === "ok" || trimmed.includes("ok")) {
          return { ok: true, service: "component-mcp" };
        }
        return { ok: false, error: `Respuesta inesperada: ${raw.slice(0, 100)}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error de conexión" };
    }
  }

  // ─── session management ─────────────────────────────────

  private getValidSession(userId: string): string | null {
    const entry = this.sessions.get(userId);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(userId);
      return null;
    }
    return entry.sessionId;
  }

  private invalidateSession(userId: string): void {
    this.sessions.delete(userId);
    this.sessionInitLocks.delete(userId);
  }

  private async ensureSession(userId: string): Promise<string> {
    const existing = this.getValidSession(userId);
    if (existing) return existing;

    const pending = this.sessionInitLocks.get(userId);
    if (pending) return pending;

    const initPromise = this.initializeSession(userId).finally(() => {
      this.sessionInitLocks.delete(userId);
    });
    this.sessionInitLocks.set(userId, initPromise);
    return initPromise;
  }

  private async initializeSession(userId: string): Promise<string> {
    const { url, token } = await this.resolveCredentials(userId);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "theforge", version: "1.0.0" },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "sin cuerpo");
      this.logger.error(`MCP initialize HTTP ${response.status}: ${body.slice(0, 300)}`);
      throw new BadRequestException(
        `Component MCP initialize respondió HTTP ${response.status}`,
      );
    }

    const sessionId = response.headers.get("mcp-session-id");
    if (!sessionId) {
      this.logger.warn("MCP initialize succeeded but no mcp-session-id header returned");
      throw new BadRequestException(
        "Component MCP no devolvió mcp-session-id en la respuesta de initialize",
      );
    }

    this.sessions.set(userId, { sessionId, createdAt: Date.now() });
    await this.sendInitializedNotification(url, token, sessionId);
    this.logger.log(`MCP session initialized for user ${userId.slice(0, 8)}…`);
    return sessionId;
  }

  /** MCP Streamable HTTP: client must ack initialize before tools/call. */
  private async sendInitializedNotification(
    url: string,
    token: string,
    sessionId: string,
  ): Promise<void> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 202) {
      const body = await response.text().catch(() => "");
      this.logger.warn(
        `MCP notifications/initialized HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
    }
  }

  /** True when the MCP server rejected our cached session (spec: HTTP 404 + re-init). */
  private isStaleSessionResponse(status: number, bodyText: string): boolean {
    const lower = bodyText.toLowerCase();
    const sessionHint =
      lower.includes("session not found") ||
      lower.includes("session expired") ||
      lower.includes("invalid session") ||
      lower.includes("unknown session") ||
      lower.includes('"code":-32001') ||
      (lower.includes("session") && lower.includes("not found"));
    if (sessionHint) return true;
    if (status === 404 && lower.includes("jsonrpc")) return true;
    if (status === 400 && (lower.includes("session") || lower.includes("initialize"))) {
      return true;
    }
    return false;
  }

  // ─── internals ────────────────────────────────────────────

  private async resolveCredentials(userId: string): Promise<{ url: string; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        componentMcpUrl: true,
        componentMcpTokenCipher: true,
        componentMcpTokenKeyVersion: true,
      },
    });
    if (!user?.componentMcpUrl) {
      throw new BadRequestException("Component MCP no configurado para este usuario");
    }
    let token = "";
    if (user.componentMcpTokenCipher && user.componentMcpTokenKeyVersion != null) {
      token = this.tokenCrypto.decrypt(
        user.componentMcpTokenCipher,
        user.componentMcpTokenKeyVersion,
      );
    }
    return { url: user.componentMcpUrl, token };
  }

  private async callTool<T>(
    userId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult<T>> {
    return this.callToolWithRetry<T>(userId, toolName, args, true);
  }

  private async callToolWithRetry<T>(
    userId: string,
    toolName: string,
    args: Record<string, unknown>,
    retryOnSessionError: boolean,
  ): Promise<McpToolResult<T>> {
    const { url, token } = await this.resolveCredentials(userId);

    const sessionId = await this.ensureSession(userId);

    const rpcId = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcId,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "sin cuerpo");
      if (retryOnSessionError && this.isStaleSessionResponse(response.status, text)) {
        this.logger.warn(
          `MCP session invalid for ${toolName} (HTTP ${response.status}), re-initializing…`,
        );
        this.invalidateSession(userId);
        return this.callToolWithRetry<T>(userId, toolName, args, false);
      }
      this.logger.error(`Component MCP ${toolName} HTTP ${response.status}: ${text.slice(0, 300)}`);
      throw new BadRequestException(
        `Component MCP respondió HTTP ${response.status}`,
      );
    }

    const raw = await response.text();
    const parsed = parseMcpResponse(raw) as Record<string, unknown> | null;
    if (!parsed) {
      throw new BadRequestException("Respuesta MCP inválida (no se pudo parsear JSON-RPC)");
    }
    if (parsed.error) {
      const errMsg = typeof parsed.error === "object"
        ? JSON.stringify(parsed.error)
        : String(parsed.error);
      throw new BadRequestException(`Component MCP error: ${errMsg}`);
    }

    const result = (parsed.result ?? parsed) as McpToolResult<T>;
    return result;
  }

  // ─── in-memory cache ──────────────────────────────────────

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private writeCache(key: string, value: unknown): void {
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
