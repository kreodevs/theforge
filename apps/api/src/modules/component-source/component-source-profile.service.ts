import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Prisma } from "@theforge/database";
import { Prisma as PrismaRuntime } from "@theforge/database";
import { getRequestUserId } from "../../common/request-user.store.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TokenCryptoService } from "../crypto/token-crypto.service.js";
import { normalizeComponentSourcePluginId } from "./component-source.plugins.js";
import { ComponentSourceCredentialService } from "./component-source-credential.service.js";
import type {
  ComponentSourceProfilePublic,
  ConfirmComponentSourceProfileMappingDto,
  CreateComponentSourceProfileDto,
  SetProjectComponentSourceProfileDto,
  TestComponentSourceProfileDto,
  ComponentSourceProfileTestResult,
  UpdateComponentSourceProfileDto,
} from "./component-source-profile.types.js";
import { ComponentSourceMcpToolsService } from "./component-source-mcp-tools.service.js";
import { ComponentSourceRegenerationService } from "./component-source-regeneration.service.js";
import { ComponentSourceToolMappingService } from "./component-source-tool-mapping.service.js";
import { parseToolMappingFromJson } from "./parse-tool-mapping.util.js";
import type { ComponentSourceCredentialResolver, ComponentSourceCredentials, ComponentSourceToolMapping } from "@theforge/component-source";
import { createPluginInstance } from "./component-source.plugins.js";
import { probeCatalogList } from "./catalog-list-probe.util.js";
import type { CatalogListValidation } from "../ai-analysis/utils/wireframes-mcp-resolve.util.js";
import { ComponentSourceRegistry } from "./component-source.registry.js";
import {
  fetchFullDesignSystemFromPort,
  type ComponentSourceDesignSystemPayload,
} from "./component-source-design-system.util.js";
import { applyDesignSystemMcpToProjectDocs } from "./sync-design-system-doc-section.util.js";

const profileSelect = {
  id: true,
  userId: true,
  name: true,
  pluginId: true,
  transportType: true,
  url: true,
  command: true,
  args: true,
  cwd: true,
  tokenCipher: true,
  tokenKeyVersion: true,
  toolMapping: true,
  capabilities: true,
  toolsListHash: true,
  mappedAt: true,
  mappingConfirmedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ComponentSourceProfileSelect;

@Injectable()
export class ComponentSourceProfileService {
  private readonly logger = new Logger(ComponentSourceProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly mcpTools: ComponentSourceMcpToolsService,
    private readonly toolMappingService: ComponentSourceToolMappingService,
    private readonly regeneration: ComponentSourceRegenerationService,
    private readonly credentialService: ComponentSourceCredentialService,
    private readonly registry: ComponentSourceRegistry,
  ) {}

  async listProfiles(userId = getRequestUserId()): Promise<ComponentSourceProfilePublic[]> {
    const rows = await this.prisma.componentSourceProfile.findMany({
      where: { userId },
      select: profileSelect,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => this.toPublic(row));
  }

  async createProfile(
    dto: CreateComponentSourceProfileDto,
    userId = getRequestUserId(),
  ): Promise<ComponentSourceProfilePublic> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException("El nombre del perfil es obligatorio");

    const transportType = dto.transportType === "stdio" ? "stdio" : "http";
    const pluginId = normalizeComponentSourcePluginId(dto.pluginId) ?? "mcp";
    const data: Prisma.ComponentSourceProfileCreateInput = {
      user: { connect: { id: userId } },
      name,
      pluginId,
      transportType,
      url: "",
      toolMapping: dto.toolMapping ?? undefined,
      capabilities: dto.capabilities ?? undefined,
      toolsListHash: dto.toolsListHash?.trim() || null,
      mappedAt: this.parseOptionalDate(dto.mappedAt),
      mappingConfirmedAt: this.parseOptionalDate(dto.mappingConfirmedAt),
    };

    if (transportType === "stdio") {
      const command = dto.command?.trim();
      if (!command) {
        throw new BadRequestException("El command es obligatorio para MCP stdio");
      }
      data.command = command;
      data.args = this.normalizeArgsInput(dto.args);
      data.cwd = dto.cwd?.trim() || null;
      data.url = "";
    } else {
      const url = dto.url?.trim();
      if (!url) throw new BadRequestException("La URL del MCP es obligatoria");
      data.url = url;
    }

    if (dto.token?.trim()) {
      const { ciphertext, keyVersion } = this.tokenCrypto.encrypt(dto.token.trim());
      data.tokenCipher = ciphertext;
      data.tokenKeyVersion = keyVersion;
    }

    try {
      const row = await this.prisma.componentSourceProfile.create({
        data,
        select: profileSelect,
      });
      return this.toPublic(row);
    } catch (err) {
      if (this.isUniqueNameConflict(err)) {
        throw new ConflictException(`Ya existe un perfil llamado "${name}"`);
      }
      throw err;
    }
  }

  async updateProfile(
    profileId: string,
    dto: UpdateComponentSourceProfileDto,
    userId = getRequestUserId(),
  ): Promise<ComponentSourceProfilePublic> {
    await this.assertProfileOwner(profileId, userId);

    const data: Prisma.ComponentSourceProfileUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException("El nombre del perfil es obligatorio");
      data.name = name;
    }
    if (dto.pluginId !== undefined) {
      data.pluginId = normalizeComponentSourcePluginId(dto.pluginId) ?? "mcp";
    }
    if (dto.transportType !== undefined) {
      data.transportType = dto.transportType === "stdio" ? "stdio" : "http";
    }
    const effectiveTransport =
      dto.transportType ??
      (await this.prisma.componentSourceProfile.findUnique({
        where: { id: profileId },
        select: { transportType: true },
      }))?.transportType ??
      "http";

    if (dto.url !== undefined) {
      const url = dto.url.trim();
      if (effectiveTransport === "http" && !url) {
        throw new BadRequestException("La URL del MCP es obligatoria");
      }
      data.url = url;
    }
    if (dto.command !== undefined) {
      const command = dto.command.trim();
      if (effectiveTransport === "stdio" && !command) {
        throw new BadRequestException("El command es obligatorio para MCP stdio");
      }
      data.command = command || null;
    }
    if (dto.args !== undefined) {
      data.args = this.normalizeArgsInput(dto.args);
    }
    if (dto.cwd !== undefined) {
      data.cwd = dto.cwd?.trim() || null;
    }
    if (dto.token !== undefined && dto.token.trim()) {
      const { ciphertext, keyVersion } = this.tokenCrypto.encrypt(dto.token.trim());
      data.tokenCipher = ciphertext;
      data.tokenKeyVersion = keyVersion;
    }
    if (dto.toolMapping !== undefined) {
      data.toolMapping =
        dto.toolMapping === null ? PrismaRuntime.JsonNull : dto.toolMapping;
    }
    if (dto.capabilities !== undefined) {
      data.capabilities =
        dto.capabilities === null ? PrismaRuntime.JsonNull : dto.capabilities;
    }
    if (dto.toolsListHash !== undefined) {
      data.toolsListHash = dto.toolsListHash?.trim() || null;
    }
    if (dto.mappedAt !== undefined) data.mappedAt = this.parseOptionalDate(dto.mappedAt);
    if (dto.mappingConfirmedAt !== undefined) {
      data.mappingConfirmedAt = this.parseOptionalDate(dto.mappingConfirmedAt);
    }

    if (Object.keys(data).length === 0) {
      const existing = await this.prisma.componentSourceProfile.findUnique({
        where: { id: profileId },
        select: profileSelect,
      });
      if (!existing) throw new NotFoundException("Perfil no encontrado");
      return this.toPublic(existing);
    }

    try {
      const row = await this.prisma.componentSourceProfile.update({
        where: { id: profileId },
        data,
        select: profileSelect,
      });
      return this.toPublic(row);
    } catch (err) {
      if (this.isUniqueNameConflict(err)) {
        throw new ConflictException("Ya existe un perfil con ese nombre");
      }
      throw err;
    }
  }

  async deleteProfile(profileId: string, userId = getRequestUserId()): Promise<{ ok: true }> {
    await this.assertProfileOwner(profileId, userId);

    const refs = await this.prisma.project.count({
      where: { componentSourceProfileId: profileId },
    });
    if (refs > 0) {
      throw new ConflictException(
        `No se puede eliminar el perfil: ${refs} proyecto(s) lo referencian. Asigna otro perfil antes.`,
      );
    }

    await this.prisma.componentSourceProfile.delete({ where: { id: profileId } });
    return { ok: true };
  }

  async getProjectProfileAssignment(
    projectId: string,
    userId = getRequestUserId(),
  ): Promise<{ profileId: string | null; profile: ComponentSourceProfilePublic | null }> {
    const project = await this.assertProjectOwner(projectId, userId);
    if (!project.componentSourceProfileId || !project.componentSourceProfile) {
      return { profileId: null, profile: null };
    }
    return {
      profileId: project.componentSourceProfileId,
      profile: this.toPublic(project.componentSourceProfile),
    };
  }

  async setProjectProfileAssignment(
    projectId: string,
    dto: SetProjectComponentSourceProfileDto,
    userId = getRequestUserId(),
  ): Promise<{ profileId: string | null; profile: ComponentSourceProfilePublic | null }> {
    const project = await this.assertProjectOwner(projectId, userId);
    const previousProfileId = project.componentSourceProfileId;

    const profileId = dto.profileId?.trim() || null;
    if (profileId) {
      await this.assertProfileOwner(profileId, userId);
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { componentSourceProfileId: profileId },
      select: {
        componentSourceProfileId: true,
        componentSourceProfile: { select: profileSelect },
      },
    });

    this.regeneration.enqueueProjectProfileChange(
      projectId,
      profileId,
      userId,
      previousProfileId,
    );

    if (!updated.componentSourceProfileId || !updated.componentSourceProfile) {
      return { profileId: null, profile: null };
    }
    return {
      profileId: updated.componentSourceProfileId,
      profile: this.toPublic(updated.componentSourceProfile),
    };
  }

  async testProfileConnection(
    profileId: string,
    dto: TestComponentSourceProfileDto = {},
    userId = getRequestUserId(),
  ): Promise<ComponentSourceProfileTestResult> {
    const profile = await this.prisma.componentSourceProfile.findUnique({
      where: { id: profileId },
      select: profileSelect,
    });
    if (!profile) throw new NotFoundException("Perfil no encontrado");
    if (profile.userId !== userId) throw new ForbiddenException("No tienes acceso a este perfil");

    const credentials = await this.credentialService.resolveForTest({
      userId,
      profileId,
      url: dto.url,
      token: dto.token,
      useSaved: dto.useSaved ?? true,
      transportType: dto.transportType,
      command: dto.command,
      args: dto.args,
      cwd: dto.cwd,
    });

    const health = await this.mcpTools.checkHealth(credentials);
    if (!health.ok) {
      return { mode: "health", ok: false, error: health.error ?? "Conexión fallida" };
    }

    const urlChanged = Boolean(dto.url?.trim() && dto.url.trim() !== profile.url.trim());
    const tokenChanged = Boolean(dto.token?.trim());
    const transportChanged = Boolean(
      dto.transportType?.trim() && dto.transportType.trim() !== profile.transportType,
    );
    const commandChanged = Boolean(
      dto.command?.trim() && dto.command.trim() !== (profile.command ?? "").trim(),
    );
    const argsChanged = Boolean(
      dto.args &&
        JSON.stringify(this.normalizeArgsInput(dto.args)) !==
          JSON.stringify(this.normalizeArgsInput(this.parseStoredArgs(profile.args))),
    );
    const cwdChanged = Boolean(
      dto.cwd !== undefined && (dto.cwd?.trim() ?? "") !== (profile.cwd ?? "").trim(),
    );
    const connectionChanged =
      urlChanged || tokenChanged || transportChanged || commandChanged || argsChanged || cwdChanged;

    let listed;
    try {
      listed = await this.mcpTools.fetchToolsList(credentials);
    } catch (err) {
      return {
        mode: "health",
        ok: false,
        error: err instanceof Error ? err.message : "tools/list falló",
      };
    }

    const hashMatches = Boolean(
      profile.toolsListHash && profile.toolsListHash === listed.toolsListHash,
    );
    const mappingConfirmed = Boolean(profile.mappingConfirmedAt);
    const useHealthOnlyMode =
      mappingConfirmed && !connectionChanged && hashMatches;

    if (useHealthOnlyMode) {
      const mapping = parseToolMappingFromJson(profile.toolMapping);
      if (mapping) {
        try {
          this.toolMappingService.validateAndNormalize(
            mapping,
            listed.tools.map((t) => t.name),
          );
        } catch (err) {
          const message =
            err instanceof BadRequestException
              ? err.message
              : err instanceof Error
                ? err.message
                : "Mapeo inválido respecto a tools/list";
          return { mode: "health", ok: false, error: message };
        }
      }
      return { mode: "health", ok: true, service: health.service ?? "mcp-tools" };
    }

    try {
      const previousMapping = parseToolMappingFromJson(profile.toolMapping);
      const proposedMapping = await this.toolMappingService.proposeMapping(listed.tools, {
        hints: dto.hints,
        previousMapping,
      });
      const capabilities = this.toolMappingService.inferCapabilities(proposedMapping);
      const catalogProbe = await this.probeCatalogListForMapping(
        credentials,
        proposedMapping,
        userId,
      );

      return {
        mode: "mapping",
        ok: true,
        proposedMapping: proposedMapping as unknown as Record<string, unknown>,
        capabilities: capabilities as unknown as Record<string, unknown>,
        toolsListHash: listed.toolsListHash,
        service: health.service,
        catalogProbe,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      return {
        mode: "health",
        ok: false,
        error: err instanceof Error ? err.message : "No se pudo proponer mapeo",
      };
    }
  }

  async confirmProfileMapping(
    profileId: string,
    dto: ConfirmComponentSourceProfileMappingDto,
    userId = getRequestUserId(),
  ): Promise<ComponentSourceProfilePublic> {
    await this.assertProfileOwner(profileId, userId);

    const credentials = await this.credentialService.resolveFromProfile(profileId);
    const listed = await this.mcpTools.fetchToolsList(credentials);
    const availableToolNames = listed.tools.map((t) => t.name);

    const mapping = this.toolMappingService.validateAndNormalize(
      dto.toolMapping as ComponentSourceToolMapping,
      availableToolNames,
    );
    const catalogProbe = await this.probeCatalogListForMapping(credentials, mapping, userId);
    if (!catalogProbe.ok) {
      throw new BadRequestException(
        catalogProbe.reason ??
          "catalog.list no devolvió módulos reconocibles. Elige otra herramienta de catálogo.",
      );
    }
    const capabilities = this.toolMappingService.inferCapabilities(mapping);
    const toolsListHash = dto.toolsListHash?.trim() || listed.toolsListHash;
    const now = new Date();

    const row = await this.prisma.componentSourceProfile.update({
      where: { id: profileId },
      data: {
        toolMapping: mapping as unknown as Prisma.InputJsonValue,
        capabilities: capabilities as unknown as Prisma.InputJsonValue,
        toolsListHash,
        mappedAt: now,
        mappingConfirmedAt: now,
      },
      select: profileSelect,
    });

    return this.toPublic(row);
  }

  /** Fetches full design system markdown from the project's assigned component source profile. */
  async fetchProjectDesignSystem(
    projectId: string,
    userId = getRequestUserId(),
  ): Promise<ComponentSourceDesignSystemPayload> {
    await this.assertProjectOwner(projectId, userId);
    const ctx = await this.registry.resolveForProject(projectId);
    if (!ctx.active || !ctx.mappingConfirmed) {
      throw new BadRequestException(
        "Fuente de componentes no activa en este proyecto. Asigna un perfil con mapeo confirmado en el taller.",
      );
    }

    const health = await ctx.port.checkHealth(ctx.ownerUserId);
    if (!health.ok) {
      throw new ServiceUnavailableException(
        health.error ?? "No se pudo conectar con la fuente de componentes (MCP).",
      );
    }

    try {
      const payload = await fetchFullDesignSystemFromPort(ctx.port, ctx.ownerUserId);
      const project = await this.prisma.project.findUnique({
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
      if (!project) throw new NotFoundException("Proyecto no encontrado");

      const mainStage = project.stages[0];
      const docSync = applyDesignSystemMcpToProjectDocs({
        designMd: payload.designMd,
        tokens: payload.tokens,
        meta: payload.meta,
        profileName: project.componentSourceProfile?.name ?? undefined,
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

      const result: ComponentSourceDesignSystemPayload = {
        ...payload,
        uxUiGuideContent: payload.designMd,
        ...(docSync.mddContent !== undefined ? { mddContent: docSync.mddContent } : {}),
        ...(docSync.brdContent !== undefined ? { brdContent: docSync.brdContent } : {}),
        ...(docSync.target
          ? {
              docSync: {
                target: docSync.target,
                sectionHeading: docSync.sectionHeading,
              },
            }
          : {}),
      };

      if (docSync.target) {
        this.logger.log(
          `fetchProjectDesignSystem: synced MCP section to ${docSync.target} project=${projectId.slice(0, 8)}…`,
        );
      }

      return result;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `fetchProjectDesignSystem failed for project ${projectId.slice(0, 8)}…: ${message}`,
      );
      throw new ServiceUnavailableException(message);
    }
  }

  /** Blocks wireframe flows when the project has no component source profile assigned. */
  async assertProjectHasProfile(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { componentSourceProfileId: true },
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (!project.componentSourceProfileId) {
      throw new BadRequestException(
        "Asigna un perfil de fuente de componentes al proyecto antes de usar wireframes.",
      );
    }
  }

  private async probeCatalogListForMapping(
    credentials: ComponentSourceCredentials,
    mapping: ComponentSourceToolMapping,
    userId: string,
  ): Promise<CatalogListValidation> {
    const resolver: ComponentSourceCredentialResolver = async () => credentials;
    const port = createPluginInstance("mcp", resolver, mapping);
    try {
      return await probeCatalogList(port, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        moduleCount: 0,
        shape: "error",
        preview: "",
        reason: `No se pudo ejecutar catalog.list: ${message}`,
      };
    }
  }

  private async assertProfileOwner(profileId: string, userId: string) {
    const profile = await this.prisma.componentSourceProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    if (!profile) throw new NotFoundException("Perfil no encontrado");
    if (profile.userId !== userId) throw new ForbiddenException("No tienes acceso a este perfil");
    return profile;
  }

  private async assertProjectOwner(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        componentSourceProfileId: true,
        componentSourceProfile: { select: profileSelect },
      },
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");
    if (project.userId !== userId) {
      throw new ForbiddenException("Solo el propietario puede gestionar el perfil del proyecto");
    }
    return project;
  }

  private toPublic(
    row: Prisma.ComponentSourceProfileGetPayload<{ select: typeof profileSelect }>,
  ): ComponentSourceProfilePublic {
    const { tokenCipher, tokenKeyVersion, userId: _userId, args, ...rest } = row;
    return {
      ...rest,
      args: this.parseStoredArgs(args),
      hasToken: !!tokenCipher,
    };
  }

  private normalizeArgsInput(args: string[] | undefined): string[] {
    if (!args?.length) return [];
    return args.map((entry) => entry.trim()).filter(Boolean);
  }

  private parseStoredArgs(value: Prisma.JsonValue | null | undefined): string[] {
    if (!value || !Array.isArray(value)) return [];
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }

  private parseOptionalDate(value: string | null | undefined): Date | null {
    if (value == null || value === "") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }
    return parsed;
  }

  private isUniqueNameConflict(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    );
  }
}
