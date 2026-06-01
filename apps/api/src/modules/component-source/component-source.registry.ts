import { Injectable, Logger } from "@nestjs/common";
import {
  NullComponentSource,
  type ComponentSourcePlugin,
  type ComponentSourcePluginMeta,
  type ComponentSourcePort,
} from "@theforge/component-source";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  buildComponentSourcePlugins,
  createPluginInstance,
  normalizeComponentSourcePluginId,
} from "./component-source.plugins.js";
import { ComponentSourceCredentialService } from "./component-source-credential.service.js";

/** Nest DI token for ComponentSourceRegistry (optional injection in tests). */
export const COMPONENT_SOURCE_REGISTRY = Symbol("COMPONENT_SOURCE_REGISTRY");

@Injectable()
export class ComponentSourceRegistry {
  private readonly logger = new Logger(ComponentSourceRegistry.name);
  private readonly plugins = new Map<string, ComponentSourcePlugin>();
  private readonly nullSource = new NullComponentSource();

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: ComponentSourceCredentialService,
  ) {
    this.registerPlugins(buildComponentSourcePlugins({ credentialService: this.credentialService }));
  }

  registerPlugins(plugins: ComponentSourcePlugin[]): void {
    for (const plugin of plugins) {
      this.plugins.set(plugin.meta.id, plugin);
      this.logger.log(`Registered component source plugin: ${plugin.meta.id}`);
    }
  }

  listPlugins(): ComponentSourcePluginMeta[] {
    return [...this.plugins.values()].map((p) => p.meta);
  }

  async resolveForUser(userId: string): Promise<ComponentSourcePort> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        componentSourceEnabled: true,
        componentSourcePluginId: true,
        componentSourceUrl: true,
      },
    });

    if (
      !user?.componentSourceEnabled ||
      !user.componentSourcePluginId?.trim() ||
      !user.componentSourceUrl?.trim()
    ) {
      return this.nullSource;
    }

    const pluginId = normalizeComponentSourcePluginId(user.componentSourcePluginId);
    const plugin = pluginId ? this.plugins.get(pluginId) : undefined;
    if (!plugin) {
      this.logger.warn(
        `Unknown component source plugin "${user.componentSourcePluginId}" for user ${userId.slice(0, 8)}…`,
      );
      return this.nullSource;
    }

    return plugin.create();
  }

  async testConnection(opts: {
    userId: string;
    pluginId?: string;
    url?: string;
    token?: string;
    useSaved?: boolean;
  }): Promise<{ ok: boolean; service?: string; error?: string }> {
    let pluginId = normalizeComponentSourcePluginId(opts.pluginId);
    if (!pluginId) {
      const user = await this.prisma.user.findUnique({
        where: { id: opts.userId },
        select: { componentSourcePluginId: true },
      });
      pluginId = normalizeComponentSourcePluginId(user?.componentSourcePluginId);
    }
    if (!pluginId) {
      pluginId = this.listPlugins()[0]?.id;
    }
    if (!pluginId || !this.plugins.has(pluginId)) {
      return { ok: false, error: `Plugin "${pluginId ?? ""}" no soportado` };
    }

    let credentials;
    try {
      credentials = await this.credentialService.resolveForTest(opts);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Error de conexión",
      };
    }

    if (!credentials.url) {
      return { ok: false, error: "URL es requerida" };
    }

    const testResolver = async () => credentials;
    let source: ComponentSourcePort;
    try {
      source = createPluginInstance(pluginId, testResolver);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Plugin no soportado",
      };
    }

    const health = await source.checkHealth(opts.userId);
    if (!health.ok) {
      return health;
    }

    try {
      await source.catalogHealth(opts.userId);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "catalog_health falló",
      };
    }

    return { ok: true, service: health.service };
  }
}
