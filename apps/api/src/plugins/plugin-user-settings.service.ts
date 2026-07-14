import { Injectable } from "@nestjs/common";
import type { Prisma } from "@theforge/database";
import { PrismaService } from "../prisma/prisma.service.js";
import type { PluginUserSettingsMap } from "@theforge/shared-types";

@Injectable()
export class PluginUserSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseMap(raw: unknown): PluginUserSettingsMap {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw as PluginUserSettingsMap;
  }

  async getForPlugin(userId: string, pluginId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.userAISettings.findUnique({
      where: { userId },
      select: { pluginUserSettings: true },
    });
    const map = this.parseMap(row?.pluginUserSettings);
    return map[pluginId] ?? {};
  }

  async getAllForUser(userId: string): Promise<PluginUserSettingsMap> {
    const row = await this.prisma.userAISettings.findUnique({
      where: { userId },
      select: { pluginUserSettings: true },
    });
    return this.parseMap(row?.pluginUserSettings);
  }

  async saveForPlugin(
    userId: string,
    pluginId: string,
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const existing = await this.prisma.userAISettings.findUnique({
      where: { userId },
      select: { pluginUserSettings: true },
    });

    const map = this.parseMap(existing?.pluginUserSettings);
    map[pluginId] = settings;

    if (existing) {
      await this.prisma.userAISettings.update({
        where: { userId },
        data: { pluginUserSettings: map as Prisma.InputJsonValue },
      });
    } else {
      await this.prisma.userAISettings.create({
        data: {
          userId,
          activeProvider: "openrouter",
          pluginUserSettings: map as Prisma.InputJsonValue,
        },
      });
    }

    return settings;
  }
}
