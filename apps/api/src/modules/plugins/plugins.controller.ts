import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
} from "@nestjs/common";
import { PluginLoaderService } from "../../plugins/plugin-loader.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { Prisma } from "@theforge/database";

@Controller("plugins")
export class PluginsController {
  constructor(
    private readonly pluginLoader: PluginLoaderService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/plugins/artifacts
   * Expone los artifact types registrados por todos los plugins cargados.
   * El frontend usa esto para renderizar paneles dinámicos en el sidebar.
   */
  @Get("artifacts")
  getArtifacts() {
    return this.pluginLoader.getArtifactTypes();
  }

  /**
   * GET /api/projects/:id/plugin-data/:pluginId
   * Devuelve los datos de un plugin específico para un proyecto.
   */
  @Get("/projects/:id/plugin-data/:pluginId")
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

  /**
   * PUT /api/projects/:id/plugin-data/:pluginId
   * Guarda los datos de un plugin para un proyecto.
   */
  @Put("/projects/:id/plugin-data/:pluginId")
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
}