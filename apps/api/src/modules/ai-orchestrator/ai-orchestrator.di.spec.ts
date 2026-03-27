/**
 * Contrato de inyección: `PROJECTS_ORCHESTRATOR_PORT` y `THEFORGE_ORCHESTRATOR_PORT`
 * permiten mocks en `TestingModule` sin acoplar `AiOrchestratorService` a las clases concretas.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PROJECTS_ORCHESTRATOR_PORT } from "../projects/projects-service.port.js";
import { THEFORGE_ORCHESTRATOR_PORT } from "../theforge/theforge-service.port.js";
test("orchestrator DI tokens are distinct symbols", () => {
  assert.notEqual(PROJECTS_ORCHESTRATOR_PORT, THEFORGE_ORCHESTRATOR_PORT);
  assert.equal(typeof PROJECTS_ORCHESTRATOR_PORT, "symbol");
  assert.equal(typeof THEFORGE_ORCHESTRATOR_PORT, "symbol");
});
