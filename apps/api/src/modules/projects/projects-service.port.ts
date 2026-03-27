import type { ProjectsService } from "./projects.service.js";

/** Token Nest para inyectar el contrato del orquestador (mocks en pruebas). */
export const PROJECTS_ORCHESTRATOR_PORT = Symbol("PROJECTS_ORCHESTRATOR_PORT");

export type IOrchestratorProjectsPort = Pick<
  ProjectsService,
  "findOne" | "update" | "tryConfirmComplexityFromChatMessage"
>;
