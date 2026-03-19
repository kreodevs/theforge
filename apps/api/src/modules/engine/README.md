# Engine (SDD)

- **`semaphore.service.ts`:** calcula `Stage.status` / `precisionScore` según `Project.complexity` (`ComplexityLevel`): **LOW** (HU + tareas), **MEDIUM** (spec/casos de uso, API, UX/flujos, tareas; sin MDD canónico obligatorio), **HIGH** (regla histórica del MDD en JSON + Figma si `hasUxTeam`).
- **`mdd-update-pipeline.service.ts`:** valida/sanitiza MDD y llama al semáforo con el contexto de entregables ya fusionado en `ProjectsService`.
- **Costes / conformidad:** `cost-calculator.service.ts`, `conformance.service.ts`.
