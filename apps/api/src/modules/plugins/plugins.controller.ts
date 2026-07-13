import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
} from "@nestjs/common";
import { PluginLoaderService } from "../../plugins/plugin-loader.service.js";
import { PluginUserSettingsService } from "../../plugins/plugin-user-settings.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { getRequestUserId } from "../../common/request-user.store.js";
import type { Prisma } from "@theforge/database";

@Controller("plugins")
export class PluginsController {
  constructor(
    private readonly pluginLoader: PluginLoaderService,
    private readonly pluginUserSettings: PluginUserSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("artifacts")
  getArtifacts() {
    return this.pluginLoader.getArtifactTypes();
  }

  @Get("settings-panels")
  getSettingsPanels() {
    return this.pluginLoader.getSettingsPanels();
  }

  @Get("user-settings")
  async getAllUserSettings() {
    return this.pluginUserSettings.getAllForUser(getRequestUserId());
  }

  @Get("projects/:id/plugin-data/:pluginId")
  async getPluginData(
    @Param("id") id: string,
    @Param("pluginId") pluginId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { pluginData: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    const data = project.pluginData as Record<string, unknown> | null;
    return data?.[pluginId] ?? null;
  }

  @Put("projects/:id/plugin-data/:pluginId")
  async setPluginData(
    @Param("id") id: string,
    @Param("pluginId") pluginId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { pluginData: true },
    });
    if (!project) throw new NotFoundException("Project not found");

    const current = (project.pluginData as Record<string, unknown>) ?? {};
    current[pluginId] = body;

    await this.prisma.project.update({
      where: { id },
      data: { pluginData: current as Prisma.InputJsonValue },
    });
    return body;
  }

  @Get(":pluginId/user-settings")
  async getUserSettings(@Param("pluginId") pluginId: string) {
    this.ensurePluginLoaded(pluginId);
    return this.pluginUserSettings.getForPlugin(getRequestUserId(), pluginId);
  }

  @Put(":pluginId/user-settings")
  async saveUserSettings(
    @Param("pluginId") pluginId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const plugin = this.ensurePluginLoaded(pluginId);
    const userId = getRequestUserId();

    let normalized = body ?? {};
    if (plugin.validateUserSettings) {
      normalized = await plugin.validateUserSettings(normalized);
    }

    const saved = await this.pluginUserSettings.saveForPlugin(userId, pluginId, normalized);

    if (plugin.onUserSettingsSaved) {
      await plugin.onUserSettingsSaved(saved, { userId });
    }

    return saved;
  }

  private ensurePluginLoaded(pluginId: string) {
    const plugin = this.pluginLoader.getPluginForSettings(pluginId);
    if (!plugin) {
      throw new NotFoundException(`Plugin '${pluginId}' is not loaded`);
    }
    const panels = this.pluginLoader.getSettingsPanels();
    if (!panels.some((p) => p.pluginId === pluginId)) {
      throw new BadRequestException(`Plugin '${pluginId}' does not expose user settings`);
    }
    return plugin;
  }
}
