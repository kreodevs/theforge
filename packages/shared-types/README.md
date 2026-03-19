# @theforge/shared-types

DTOs e interfaces compartidas (Zod).

- Status, ChecklistResult, MddJson.
- createProjectSchema, updateProjectSchema, sessionResponseSchema, etc.
- `ComplexityLevelEnum` (`LOW` | `MEDIUM` | `HIGH`): política de adopción SDD y semáforo (campo `complexity` en proyecto).
- `orchestrator.ts`: `chatOrchestratorResponseSchema` (respuesta stream/orquestador; incluye `evaluatorCritique` opcional).

Usado por API y (opcional) por web.
