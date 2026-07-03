/**
 * @fileoverview **UiScreensService** — genera el deliverable "Pantallas / UI Screens Spec" (texto)
 * a partir del MCP gráfico compatible activo.
 *
 * Estrategia: `list_screens` (spec estructurada de pantallas) con respaldo por-entidad vía
 * `resolve_component` cuando el MCP no soporta `list_screens`. Ensambla markdown de texto (sin TSX ni
 * preview) y lo persiste en `Project.uiScreensContent`.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ListScreensEntity, ScreenSpec } from "@theforge/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import { extractSection3Body } from "../ai-analysis/utils/mdd-sanitize.js";
import { UiMcpClientService } from "./ui-mcp-client.service.js";
import { UiMcpService } from "./ui-mcp.service.js";
import { buildUiScreensMarkdown } from "./ui-screens-markdown.util.js";

/** Extrae nombres de entidades (CREATE TABLE) del cuerpo de §3. */
function parseEntities(section3: string): string[] {
  const entities: string[] = [];
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?(\w+)(?:`|"|')?/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section3)) !== null) {
    const name = match[1];
    if (name && !entities.includes(name)) entities.push(name);
  }
  return entities;
}

@Injectable()
export class UiScreensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uiMcpClient: UiMcpClientService,
    private readonly uiMcp: UiMcpService,
  ) {}

  /**
   * Genera y persiste el deliverable "Pantallas" para un proyecto.
   * Requiere un MCP gráfico compatible activo; de lo contrario lanza `BadRequestException`.
   */
  async syncUiScreens(projectId: string): Promise<{ content: string; screens: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, specContent: true },
    });
    if (!project) throw new NotFoundException("Proyecto no encontrado");

    if (!(await this.uiMcpClient.isActive())) {
      throw new BadRequestException(
        "No hay un MCP gráfico compatible activo. Actívalo en Ajustes › MCP gráfico.",
      );
    }

    const mdd = project.specContent ?? "";
    const section3 = extractSection3Body(mdd);
    const entityNames = section3 ? parseEntities(section3) : [];
    if (entityNames.length === 0) {
      throw new BadRequestException(
        "El MDD del proyecto no tiene entidades en §3 (Modelo de Datos) para derivar pantallas.",
      );
    }

    const entities: ListScreensEntity[] = entityNames.map((name) => ({
      name,
      restEndpoint: `GET /api/v1/${name}`,
    }));

    let screens = await this.uiMcpClient.listScreens({ entities });
    if (!screens) {
      screens = await this.buildScreensFromResolve(entities);
    }
    if (!screens || screens.length === 0) {
      throw new BadRequestException(
        "El MCP gráfico no devolvió pantallas para las entidades del proyecto.",
      );
    }

    const meta = await this.uiMcp.getActiveCompatibleMeta();
    const content = buildUiScreensMarkdown(screens, {
      libraryName: meta?.libraryName,
      libraryVersion: meta?.libraryVersion,
      contractVersion: meta?.contractVersion,
      generatedAt: new Date(),
    });
    if (!content) {
      throw new BadRequestException("No se pudo ensamblar el documento de pantallas.");
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { uiScreensContent: content },
    });

    return { content, screens: screens.length };
  }

  /** Respaldo: una pantalla por entidad usando `resolve_component`. */
  private async buildScreensFromResolve(entities: ListScreensEntity[]): Promise<ScreenSpec[]> {
    const screens: ScreenSpec[] = [];
    for (const entity of entities) {
      const resolved = await this.uiMcpClient.resolveComponent({
        entityName: entity.name,
        classification: entity.classification,
        keyFields: entity.keyFields,
        restEndpoint: entity.restEndpoint,
      });
      if (!resolved) continue;
      screens.push({
        name: `Gestión de ${entity.name}`,
        purpose: `Pantalla para administrar la entidad \`${entity.name}\`.`,
        components: [
          {
            component: resolved.component,
            package: resolved.package,
            version: resolved.version,
            entity: entity.name,
            props: resolved.propMapping ?? {},
          },
        ],
        endpoints: entity.restEndpoint ? [entity.restEndpoint] : [],
      });
    }
    return screens;
  }
}
