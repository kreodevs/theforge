# MDD background jobs

Cola de generación/regeneración del MDD desacoplada del SSE del navegador.

## Cola

- Nombre BullMQ: `theforge-mdd` (`MddQueueService`, `mdd-queue.service.ts`).
- Con `REDIS_URL`: jobs persistentes en Redis (sobreviven cerrar el navegador).
- Sin Redis: cola in-memory secuencial por proyecto en el mismo proceso Node (no sobrevive reinicio del API).

## Modos (`MddJobMode`)

| Modo | Origen | Generador |
|------|--------|-----------|
| `pipeline` | Greenfield — benchmark → MDD | `streamMddAnalysis` |
| `manager` | Greenfield — chat Manager (arranque) | `streamMddAnalysisWithManager` |
| `section` | Greenfield — `/seguridad`, etc. | `streamMddRegenerateSection` |
| `legacy` | Proyectos `LEGACY` | `LegacyCoordinatorService.generateMdd` |

Un solo job MDD activo o en cola por proyecto (`assertCanEnqueue` → 409 si busy).

## Persistencia

`AiAnalysisService.runMddGenerationJob` persiste borradores (`draft`) y resultado final (`done`) en BD vía `projects.persistMddFromBackgroundJob`:

- **Borradores:** `prepareMddForOutput` + guardado en stage **sin** delivery gate (el MDD puede faltar §1–§7 a mitad de pipeline).
- **Final (`done`):** pipeline completo (`MddUpdatePipelineService`) con gate de entrega, semáforo y estimación.

El Workshop ya no depende de `persistMddContent` tras encolar.

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/ai-analysis/mdd/jobs` | Encola greenfield (`pipeline` \| `manager` \| `section`) |
| `GET` | `/ai-analysis/mdd/jobs/:jobId` | Estado del job |
| `GET` | `/projects/:id/mdd-jobs/:jobId` | Alias polling (web) |
| `POST` | `/projects/:id/legacy/generate-mdd` | Encola legacy por defecto (`?queue=false` sync) |
| `GET` | `/projects/:id/legacy/mdd-jobs/:jobId` | Polling legacy |

SSE (`POST …/mdd/stream`, `…/stream/manager`, `…/regenerate-section`) sigue disponible; el Workshop usa jobs por defecto.

## Frontend

- `apps/web/src/utils/pollMddJob.ts` — `enqueueAndPollMddJob`, `enqueueAndPollLegacyMdd`.
- `workshopStore`: `generateMddFromBenchmark`, `legacyGenerateMdd`, regeneración §N vía cola.

## Gates

`ProjectGenerationGuardService` incluye `mddQueue.isProjectBusy()` en `mddStreamActive` para bloquear entregables downstream mientras corre un job MDD.
