# Engine (SDD)

- **`semaphore.service.ts`:** calcula `Stage.status` / `precisionScore` según `Project.complexity` (`ComplexityLevel`): **LOW** (HU + tareas), **MEDIUM** (spec/casos de uso, API, UX/flujos, tareas; sin MDD canónico obligatorio), **HIGH** (MDD JSON + Figma si `hasUxTeam`). En HIGH, si `sddDomainGraphOk` (Grafo Falkor sin dependencias huérfanas §3–§4), puede pasar de AMARILLO a VERDE sin exigir textos largos de `edge_cases`/`field_types` (`precisionScore` 92 en ese camino).
- **`mdd-update-pipeline.service.ts`:** valida/sanitiza MDD, sincroniza el borrador al Grafo SDD (`GraphMemoryService`) y evalúa `evaluateSddDependencyHealth` antes del semáforo cuando hay `projectId`/`stageId` y complejidad HIGH.
- **Costes / conformidad:** `cost-calculator.service.ts` delega la fórmula en `@theforge/business-rules`; `conformance.service.ts`.
