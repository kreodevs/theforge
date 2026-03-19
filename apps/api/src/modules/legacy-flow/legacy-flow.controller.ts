import { Body, Controller, Param, Post } from "@nestjs/common";
import { LegacyCoordinatorService } from "./legacy-coordinator.service.js";

/**
 * Controlador REST del flujo legacy: inicio (Relic), respuestas, generación de MDD y de entregables en cascada.
 */
@Controller("projects/:projectId/legacy")
export class LegacyFlowController {
  constructor(private readonly coordinator: LegacyCoordinatorService) {}

  /**
   * Inicia el flujo legacy: envía la descripción a Relic y obtiene archivos a modificar y preguntas para afinar.
   * @param projectId - ID del proyecto (debe ser tipo LEGACY con theforgeProjectId).
   * @param body.description - Descripción de la modificación que quiere el usuario.
   * @returns Lista de archivos, preguntas y respuestas sugeridas (opcional).
   */
  @Post("start")
  async start(
    @Param("projectId") projectId: string,
    @Body() body: { description?: string },
  ) {
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    return this.coordinator.start(projectId, description);
  }

  /**
   * Registra las respuestas del usuario a las preguntas del flujo. Persiste en legacyFlowState.answers.
   * @param projectId - ID del proyecto.
   * @param body.answers - Mapa índice → respuesta (p. ej. { "0": "10", "1": "30" }).
   * @returns { ok: true }.
   */
  @Post("answer")
  async answer(
    @Param("projectId") projectId: string,
    @Body() body: { answers?: Record<string, string> },
  ) {
    const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};
    return this.coordinator.answer(projectId, answers);
  }

  /**
   * Genera el MDD de cambio a partir del estado del flujo (descripción, archivos, respuestas) y contexto Relic. Persiste en mddContent.
   * @param projectId - ID del proyecto.
   * @returns Contenido Markdown del MDD generado.
   */
  @Post("generate-mdd")
  async generateMdd(@Param("projectId") projectId: string) {
    return this.coordinator.generateMdd(projectId);
  }

  /**
   * Genera en cascada todos los entregables (SPEC, Arquitectura, Casos de uso, Historias, Blueprint, Guía UX/UI, API, Flujos, Infra, Tasks) desde el MDD.
   * @param projectId - ID del proyecto (debe tener mddContent generado previamente).
   * @returns Confirmación de que la cascada terminó.
   */
  @Post("generate-deliverables")
  async generateDeliverables(@Param("projectId") projectId: string) {
    return this.coordinator.generateDeliverables(projectId);
  }
}
