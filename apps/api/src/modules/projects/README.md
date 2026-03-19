# Projects

CRUD de proyectos, actualización de MDD y entregables (Blueprint, API, etc.).

- **Stage (Prisma):** `mddContent`, semáforo SDD (`status` ROJO/AMARILLO/VERDE), `precisionScore`, `estimation` y `workflowStatus` (DRAFT/ACTIVE/…) viven por etapa. `PATCH /projects/:id` puede llevar `stageId` para apuntar a una etapa concreta; si no, se usa la etapa activa (`workflowStatus === ACTIVE`) o la de menor `ordinal`.
- **Rutas etapas:** `POST /projects/:id/stages` (crear, opcional `copyMddFromStageId`, `activate`); `PATCH /projects/:id/stages/:stageId` (nombre/clave/ordinal, `activate: true` para exclusividad ACTIVE).
- **ProjectsService:** `findOne` / `findAll` aplanan `mddContent`, `status`, `precisionScore` y `estimation` desde la etapa principal para compatibilidad con el front. Generación de entregables lee el MDD de esa etapa.
- **ProjectEstimationRecalcService:** Upsert de `Estimation` por `stageId` (horas/MXN/team) cuando cambian MDD o infra.
- **stage-helpers.ts:** `pickPrimaryStage`, `flattenStageDeliverables`.
- **Engine (MddUpdatePipelineService):** Validación de MDD al persistir en etapa.
- **Complejidad HITL:** `complexityPending` (JSON) propone nivel + plan hasta confirmación en el chat o vía `POST /projects/:id/confirm-complexity`. Con propuesta pendiente, `POST /projects/:id/generate-deliverables` responde 400.
- **Entregables:** `POST /projects/:id/generate-deliverables` itera `DELIVERABLES_BY_COMPLEXITY` (`@theforge/shared-types`) — solo genera los documentos listados para el nivel efectivo.
- **Re-valorar complejidad:** `POST /projects/:id/reassess-complexity` (body opcional `{ note?: string }`) — vuelve a inferir `complexityPending` desde DBGA/MDD/Spec existentes sin re-ejecutar el stream DBGA.
