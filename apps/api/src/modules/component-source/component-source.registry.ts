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
import {
  isConfirmedToolMapping,
  parseToolMappingFromJson,
} from "./parse-tool-mapping.util.js";

/** Nest DI token for ComponentSourceRegistry (optional injection in tests). */
export const COMPONENT_SOURCE_REGISTRY = Symbol("COMPONENT_SOURCE_REGISTRY");

export type ProjectComponentSourceContext = {
  profileId: string | null;
  active: boolean;
  port: ComponentSourcePort;
  ownerUserId: string;
  /** Profile has mappingConfirmedAt and valid catalog.list mapping. */
  mappingConfirmed: boolean;
};

@Injectable()
export class ComponentSourceRegistry {
  private readonly logger = new Logger(ComponentSourceRegistry.name);
  private readonly plugins = new Map<string, ComponentSourcePlugin>();
  private readonly nullSource = new NullComponentSource();

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialService: ComponentSourceCredentialService,
  ) {
    this.registerPlugins(buildComponentSourcePlugins());
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

  /**
   * Resolves component source from the project's assigned profile (preferred path).
   * Returns inactive NullComponentSource when no profile is assigned.
   */
  async resolveForProject(projectId: string): Promise<ProjectComponentSourceContext> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        componentSourceProfileId: true,
        componentSourceProfile: {
          select: {
            id: true,
            pluginId: true,
            url: true,
            toolMapping: true,
            mappingConfirmedAt: true,
          },
        },
      },
    });

    if (!project) {
      return {
        profileId: null,
        active: false,
        port: this.nullSource,
        ownerUserId: "",
        mappingConfirmed: false,
      };
    }

    const profile = project.componentSourceProfile;
    if (!project.componentSourceProfileId || !profile?.url?.trim()) {
      return {
        profileId: null,
        active: false,
        port: this.nullSource,
        ownerUserId: project.userId,
        mappingConfirmed: false,
      };
    }

    const pluginId = normalizeComponentSourcePluginId(profile.pluginId);
    if (!pluginId || !this.plugins.has(pluginId)) {
      this.logger.warn(
        `Unknown component source plugin "${profile.pluginId}" for profile ${profile.id.slice(0, 8)}…`,
      );
      return {
        profileId: profile.id,
        active: false,
        port: this.nullSource,
        ownerUserId: project.userId,
        mappingConfirmed: false,
      };
    }

    const toolMapping = parseToolMappingFromJson(profile.toolMapping);
    const mappingConfirmed = isConfirmedToolMapping(profile.mappingConfirmedAt, profile.toolMapping);

    if (!mappingConfirmed || !toolMapping) {
      this.logger.warn(
        `Profile ${profile.id.slice(0, 8)}… assigned but tool mapping not confirmed or missing catalog.list`,
      );
      return {
        profileId: profile.id,
        active: false,
        port: this.nullSource,
        ownerUserId: project.userId,
        mappingConfirmed: false,
      };
    }

    const resolver = this.credentialService.createProfileResolver(profile.id);
    const port = createPluginInstance(pluginId, resolver, toolMapping);
    return {
      profileId: profile.id,
      active: true,
      port,
      ownerUserId: project.userId,
      mappingConfirmed: true,
    };
  }

  async testConnection(opts: {
    userId: string;
    profileId?: string;
    pluginId?: string;
    url?: string;
    token?: string;
    useSaved?: boolean;
  }): Promise<{ ok: boolean; service?: string; error?: string }> {
    let pluginId = normalizeComponentSourcePluginId(opts.pluginId);
    const profileId = opts.profileId?.trim();

    if (!pluginId && profileId) {
      const profile = await this.prisma.componentSourceProfile.findUnique({
        where: { id: profileId },
        select: { pluginId: true, userId: true },
      });
      if (profile && profile.userId !== opts.userId) {
        return { ok: false, error: "Perfil no encontrado" };
      }
      pluginId = normalizeComponentSourcePluginId(profile?.pluginId);
    }

    if (!pluginId) {
      pluginId = this.listPlugins()[0]?.id;
    }
    if (!pluginId || !this.plugins.has(pluginId)) {
      return { ok: false, error: `Plugin "${pluginId ?? ""}" no soportado` };
    }

    let credentials;
    let testToolMapping;
    try {
      credentials = await this.credentialService.resolveForTest(opts);
      if (profileId) {
        const profileRow = await this.prisma.componentSourceProfile.findUnique({
          where: { id: profileId },
          select: { toolMapping: true, mappingConfirmedAt: true },
        });
        if (isConfirmedToolMapping(profileRow?.mappingConfirmedAt, profileRow?.toolMapping)) {
          testToolMapping = parseToolMappingFromJson(profileRow?.toolMapping) ?? undefined;
        }
      }
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
      source = createPluginInstance(pluginId, testResolver, testToolMapping);
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
