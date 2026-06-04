import {
  ComponentSourceError,
  inferCapabilitiesFromMapping,
  isStdioCredentials,
  type CatalogHealthResult,
  type ComponentCode,
  type ComponentModule,
  type ComponentPreviewItem,
  type ComponentProps,
  type ComponentPreviewsBatchResult,
  type ComponentResolution,
  type ComponentSourceCredentials,
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
  buildShadcnExamplesArgs,
  buildShadcnListModulesArgs,
  buildShadcnSearchModulesArgs,
  buildShadcnViewItemsArgs,
  isShadcnRegistryListTool,
  isShadcnRegistryViewTool,
  parseRegistriesFromProjectRegistriesText,
  resolveShadcnProjectRegistriesToolName,
  SHADCN_DEFAULT_REGISTRIES,
} from "./shadcn-registry-tools.js";
import {
  buildMagicUiGetComponentArgs,
  buildMagicUiListModulesArgs,
  buildMagicUiSearchModulesArgs,
  isMagicUiListTool,
  isMagicUiSearchTool,
} from "./magic-ui-registry-tools.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface RpcClientEntry {
  client: McpRpcClient;
  createdAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const RPC_CLIENT_TTL_MS = 30 * 60 * 1000;

/**
 * MCP client that resolves {@link ComponentSourcePort} methods via a role → tool name mapping.
 */
export class MappedMcpComponentSource implements ComponentSourcePort {
  readonly capabilities;
  private readonly logger: ComponentSourceLogger;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly rpcClients = new Map<string, RpcClientEntry>();

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

  private async requireCredentials(userId: string): Promise<ComponentSourceCredentials> {
    const creds = await this.resolveCredentials(userId);
    if (!creds) {
      throw new ComponentSourceError("Component Source no configurado para este usuario");
    }
    if (isStdioCredentials(creds)) {
      if (!creds.command?.trim()) {
        throw new ComponentSourceError("Perfil MCP stdio sin command configurado");
      }
      return creds;
    }
    if (!creds.url?.trim()) {
      throw new ComponentSourceError("Component Source no configurado para este usuario");
    }
    return creds;
  }

  private async getRpcClient(userId: string): Promise<McpRpcClient> {
    const existing = this.rpcClients.get(userId);
    if (existing && Date.now() - existing.createdAt <= RPC_CLIENT_TTL_MS) {
      return existing.client;
    }
    if (existing) {
      await existing.client.close().catch(() => undefined);
    }
    const credentials = await this.requireCredentials(userId);
    const client = new McpRpcClient(credentials, {
      logger: this.logger,
      clientName: this.clientName,
      clientVersion: this.clientVersion,
    });
    this.rpcClients.set(userId, { client, createdAt: Date.now() });
    return client;
  }

  async searchModules(userId: string, query: string): Promise<McpToolResult<ComponentModule[]>> {
    const toolName = this.mappedToolName("catalog.search");
    this.logger.log(`[ComponentMCP] ${toolName} userId=${userId.slice(0, 8)}… query="${query}"`);
    const result = await this.callTool<ComponentModule[]>(
      userId,
      toolName,
      isMagicUiSearchTool(toolName)
        ? buildMagicUiSearchModulesArgs(toolName, query)
        : buildShadcnSearchModulesArgs(
            toolName,
            await this.resolveShadcnRegistries(userId),
            query,
          ),
    );
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
    const registries = await this.resolveShadcnRegistries(userId);
    const result = await this.callTool<{ results: ComponentResolution[] }>(
      userId,
      toolName,
      buildShadcnViewItemsArgs(toolName, names, registries),
    );
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

    const result = await this.callTool<ComponentCode>(
      userId,
      toolName,
      isShadcnRegistryViewTool(toolName)
        ? buildShadcnViewItemsArgs(toolName, [moduleId], await this.resolveShadcnRegistries(userId))
        : buildMagicUiGetComponentArgs(toolName, moduleId, exportName),
    );
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
    const registries = await this.resolveShadcnRegistries(userId);
    return this.callTool<CompositionRecipe>(
      userId,
      toolName,
      buildShadcnExamplesArgs(toolName, moduleId, registries),
    );
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
    let args: Record<string, unknown> = {};
    if (isShadcnRegistryListTool(toolName)) {
      const registries = await this.resolveShadcnRegistries(userId);
      args = buildShadcnListModulesArgs(toolName, registries);
      this.logger.log(
        `[ComponentMCP] ${toolName} shadcn registries=${JSON.stringify(registries)}`,
      );
    } else if (isMagicUiListTool(toolName)) {
      args = buildMagicUiListModulesArgs(toolName);
    }
    const result = await this.callTool<ComponentModule[]>(userId, toolName, args);
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
    const client = await this.getRpcClient(userId);
    return client.checkHealth();
  }

  private async resolveShadcnRegistries(userId: string): Promise<string[]> {
    const cacheKey = `shadcnRegistries:${userId}`;
    const cached = this.readCache<string[]>(cacheKey);
    if (cached?.length) return cached;

    const probeTool = resolveShadcnProjectRegistriesToolName(this.toolMapping);
    try {
      const result = await this.callTool<unknown>(userId, probeTool, {});
      const text = result.content?.find((c) => c.type === "text")?.text ?? "";
      const parsed = parseRegistriesFromProjectRegistriesText(text);
      if (parsed.length > 0) {
        this.writeCache(cacheKey, parsed);
        return parsed;
      }
    } catch {
      /* fall through to default */
    }

    const fallback = [...SHADCN_DEFAULT_REGISTRIES];
    this.writeCache(cacheKey, fallback);
    return fallback;
  }

  private async callTool<T>(
    userId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult<T>> {
    const client = await this.getRpcClient(userId);
    const result = await client.callRpc("tools/call", {
      name: toolName,
      arguments: args,
    });
    return result as McpToolResult<T>;
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
