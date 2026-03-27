# AI Orchestrator

- **`AiOrchestratorService`:** chat y streaming del Workshop; persiste MDD/DBGA/UX vía contratos de proyecto y enriquece flujo **LEGACY** con `askCodebase`.
- **Inyección:** usa `PROJECTS_ORCHESTRATOR_PORT` e `THEFORGE_ORCHESTRATOR_PORT` (`projects-service.port.ts`, `theforge-service.port.ts`) en lugar de las clases concretas, para poder sustituir `ProjectsService` / `TheForgeService` por mocks en pruebas (`useExisting` en los módulos Nest).
- **Prueba mínima de contrato:** `ai-orchestrator.di.spec.ts` (tokens únicos).
