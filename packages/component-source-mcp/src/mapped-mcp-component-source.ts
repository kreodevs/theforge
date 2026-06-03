import {
  ComponentSourceError,
  inferCapabilitiesFromMapping,
  parseMcpResponse,
  type CatalogHealthResult,
  type ComponentCode,
  type ComponentModule,
  type ComponentPreviewItem,
  type ComponentProps,
  type ComponentPreviewsBatchResult,
  type ComponentResolution,
  type ComponentSourcePort,
  type ComponentSourceRole,
  type ComponentSourceToolMapping,
  type CompositionRecipe,
  type DesignSystemResult,
  type GetDesignSystemArgs,
  type HostedPreviewPayload,
  type McpToolResult,
  type StyleRule,
} from "@theforge/component-source";
import type { ComponentSourceCredentialResolver } from "@theforge/component-source";
import {
  defaultComponentSourceLogger,
  type ComponentSourceLogger,
  type McpComponentSourceOptions,
} from "./options.js";
import { McpRpcClient } from "./mcp-rpc-client.js";
import {
  buildMcpHttpHeaders,
  initializeMcpHttpSession,
} from "./mcp-transport.util.js";

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

/**
 * MCP client that resolves {@link ComponentSourcePort} methods via a role → tool name mapping.
 */
export class MappedMcpComponentSource implements ComponentSourcePort {
  readonly capabilities;
  private readonly logger: ComponentSourceLogger;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly sessions = new Map<string, McpSession>();
  private readonly sessionInitLocks = new Map<string, Promise<string>>();

  constructor(
    private readonly resolveCredentials: ComponentSourceCredentialResolver,
    private readonly toolMapping: ComponentSourceToolMapping,
    options: McpComponentSourceOptions = {},
  ) {
    this.logger = options.logger ?? defaultComponentSourceLogger;
    this.clientName = options.clientName ?? "theforge";
    this.clientVersion = options.clientVersion ?? "1.0.0";
    this.capabilities = inferCapabilitiesFromMapping(toolMapping);
  }

  private mappedToolName(role: ComponentSourceRole, required = true): string {
    const toolName = this.toolMapping[role]?.toolName?.trim();
    if (!toolName) {
      if (required) {
        throw new ComponentSourceError(`Component source tool mapping missing required role: ${role}`);
      }
      throw new ComponentSourceError(`Component source capability unavailable: ${role}`);
    }
    return toolName;
  }

  private async requireCredentials(userId: string): Promise<{ url: string; token?: string }> {
    const creds = await this.resolveCredentials(userId);
    if (!creds?.url?.trim()) {
      throw new ComponentSourceError("Component Source no configurado para este usuario");
    }
    return creds;
  }

  async searchModules(userId: string, query: string): Promise<McpToolResult<ComponentModule[]>> {
    const toolName = this.mappedToolName("catalog.search");
    this.logger.log(`[ComponentMCP] ${toolName} userId=${userId.slice(0, 8)}… query="${query}"`);
    const result = await this.callTool<ComponentModule[]>(userId, toolName, { query });
    this.logger.log(`[ComponentMCP] ${toolName} done contentItems=${result.content?.length ?? 0}`);
    return result;
  }

  async resolveComponents(
    userId: string,
    names: string[],
  ): Promise<McpToolResult<{ results: ComponentResolution[] }>> {
    const toolName = this.mappedToolName("catalog.resolve");
    const cacheKey = `resolveComponents:${userId}:${names.sort().join(",")}`;
    const cached = this.readCache<McpToolResult<{ results: ComponentResolution[] }>>(cacheKey);
    if (cached) {
      this.logger.log(`[ComponentMCP] ${toolName} cache hit names=${names.length}`);
      return cached;
    }

    this.logger.log(`[ComponentMCP] ${toolName} userId=${userId.slice(0, 8)}… names=${names.length}`);
    const result = await this.callTool<{ results: ComponentResolution[] }>(userId, toolName, {
      names,
    });
    const preview = result.content?.find((c) => c.type === "text")?.text?.slice(0, 400) ?? "";
    this.logger.log(`[ComponentMCP] ${toolName} done preview=${JSON.stringify(preview)}`);
    this.writeCache(cacheKey, result);
    return result;
  }

  async getComponent(
    userId: string,
    moduleId: string,
    exportName?: string,
  ): Promise<McpToolResult<ComponentCode>> {
    const toolName = this.mappedToolName("catalog.get");
    const cacheKey = `getComponent:${userId}:${moduleId}:${exportName ?? ""}`;
    const cached = this.readCache<McpToolResult<ComponentCode>>(cacheKey);
    if (cached) return cached;

    const result = await this.callTool<ComponentCode>(userId, toolName, {
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
    const toolName = this.mappedToolName("catalog.props");
    return this.callTool<ComponentProps>(userId, toolName, {
      moduleId,
      ...(exportName ? { exportName } : {}),
    });
  }

  async getCompositionRecipe(
    userId: string,
    moduleId: string,
  ): Promise<McpToolResult<CompositionRecipe>> {
    const toolName = this.mappedToolName("catalog.recipe");
    return this.callTool<CompositionRecipe>(userId, toolName, { moduleId });
  }

  async listModules(userId: string): Promise<McpToolResult<ComponentModule[]>> {
    const toolName = this.mappedToolName("catalog.list");
    const cacheKey = `listModules:${userId}`;
    const cached = this.readCache<McpToolResult<ComponentModule[]>>(cacheKey);
    if (cached) {
      this.logger.log(`[ComponentMCP] ${toolName} cache hit userId=${userId.slice(0, 8)}…`);
      return cached;
    }

    this.logger.log(`[ComponentMCP] ${toolName} userId=${userId.slice(0, 8)}…`);
    const result = await this.callTool<ComponentModule[]>(userId, toolName, {});
    const text = result.content?.find((c) => c.type === "text")?.text ?? "";
    this.logger.log(
      `[ComponentMCP] ${toolName} done textLen=${text.length} preview=${JSON.stringify(text.slice(0, 300))}`,
    );
    this.writeCache(cacheKey, result);
    return result;
  }

  async catalogHealth(userId: string): Promise<McpToolResult<CatalogHealthResult>> {
    const toolName = this.mappedToolName("catalog.health");
    return this.callTool<CatalogHealthResult>(userId, toolName, {});
  }

  async getStyleRules(userId: string): Promise<McpToolResult<StyleRule[]>> {
    const toolName = this.mappedToolName("designSystem.styleRules");
    return this.callTool<StyleRule[]>(userId, toolName, {});
  }

  async getDesignSystem(
    userId: string,
    args?: GetDesignSystemArgs,
  ): Promise<McpToolResult<DesignSystemResult>> {
    const toolName = this.mappedToolName("designSystem.get");
    const format = args?.format ?? "full";
    const theme = args?.theme ?? "light";
    const includeMarkdown = args?.includeMarkdown;
    const cacheKey = `getDesignSystem:${userId}:${format}:${theme}:${includeMarkdown ?? ""}`;
    const cached = this.readCache<McpToolResult<DesignSystemResult>>(cacheKey);
    if (cached) {
      this.logger.log(`[ComponentMCP] ${toolName} cache hit userId=${userId.slice(0, 8)}…`);
      return cached;
    }

    this.logger.log(
      `[ComponentMCP] ${toolName} userId=${userId.slice(0, 8)}… format=${format} theme=${theme}`,
    );
    const result = await this.callTool<DesignSystemResult>(userId, toolName, {
      format,
      theme,
      ...(includeMarkdown !== undefined ? { includeMarkdown } : {}),
    });
    this.writeCache(cacheKey, result);
    return result;
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
    const toolName = this.mappedToolName("preview.single");
    return this.callTool<HostedPreviewPayload>(userId, toolName, {
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
    const toolName = this.mappedToolName("preview.batch");
    this.logger.log(
      `[ComponentMCP] ${toolName} userId=${userId.slice(0, 8)}… items=${args.items.length} mode=${args.mode ?? "html"}`,
    );
    return this.callTool(userId, toolName, {
      items: args.items,
      theme: args.theme ?? "light",
      mode: args.mode ?? "html",
    });
  }

  async checkHealth(userId: string): Promise<{ ok: boolean; service?: string; error?: string }> {
    const credentials = await this.requireCredentials(userId);
    const client = new McpRpcClient(credentials, {
      logger: this.logger,
      clientName: this.clientName,
      clientVersion: this.clientVersion,
    });
    return client.checkHealth();
  }

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
    const { url, token } = await this.requireCredentials(userId);
    const sessionId = await initializeMcpHttpSession({
      url,
      token,
      clientName: this.clientName,
      clientVersion: this.clientVersion,
      logger: this.logger,
    });
    this.sessions.set(userId, { sessionId, createdAt: Date.now() });
    this.logger.log(`MCP session initialized for user ${userId.slice(0, 8)}…`);
    return sessionId;
  }

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
    const { url, token } = await this.requireCredentials(userId);
    const sessionId = await this.ensureSession(userId);

    const rpcId = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: buildMcpHttpHeaders(sessionId, token),
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
      throw new ComponentSourceError(`Component MCP respondió HTTP ${response.status}`);
    }

    const raw = await response.text();
    const parsed = parseMcpResponse(raw) as Record<string, unknown> | null;
    if (!parsed) {
      throw new ComponentSourceError("Respuesta MCP inválida (no se pudo parsear JSON-RPC)");
    }
    if (parsed.error) {
      const errMsg =
        typeof parsed.error === "object" ? JSON.stringify(parsed.error) : String(parsed.error);
      throw new ComponentSourceError(`Component MCP error: ${errMsg}`);
    }

    return (parsed.result ?? parsed) as McpToolResult<T>;
  }

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
