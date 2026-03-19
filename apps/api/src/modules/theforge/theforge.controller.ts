import { Controller, Get, Logger } from "@nestjs/common";
import { TheForgeService } from "./theforge.service.js";

/**
 * Controlador REST para integración con TheForge (MCP FalkorSpecs).
 * Expone el listado de proyectos indexados para que la web permita crear proyectos legacy vinculados.
 */
@Controller("theforge")
export class TheForgeController {
  private readonly logger = new Logger(TheForgeController.name);

  constructor(private readonly theforge: TheForgeService) {}

  /**
   * Lista los proyectos indexados en TheForge (multi-root) y si el servicio está disponible.
   * @returns Lista de proyectos (id, name, roots con id/name/branch por repo) y flag theforgeAvailable.
   */
  @Get("projects")
  async listProjects(): Promise<{
    projects: Array<{ id: string; name: string; roots?: Array<{ id: string; name?: string; branch?: string }>; rootPath?: string; branch?: string }>;
    theforgeAvailable: boolean;
  }> {
    this.logger.log("[TheForge] GET /theforge/projects requested");
    const available = this.theforge.isConfigured();
    if (!available) {
      this.logger.log("[TheForge] GET /theforge/projects: theforgeAvailable=false (no config)");
      return { projects: [], theforgeAvailable: false };
    }
    const projects = await this.theforge.listKnownProjects();
    this.logger.log(`[TheForge] GET /theforge/projects: returning theforgeAvailable=true, projects.length=${projects.length}`);
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        roots: p.roots,
        rootPath: p.rootPath,
        branch: p.branch,
      })),
      theforgeAvailable: true,
    };
  }
}
