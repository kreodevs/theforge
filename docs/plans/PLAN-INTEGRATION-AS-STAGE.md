# Plan: Integration as stage (promote handoff → legacy stage)

> **Estado:** P1 implementado (junio 2026)

## Resumen

Permite promover ítems de handoff del proyecto NEW a una **nueva etapa legacy** (ordinal N+1) con activación opcional, importando snapshot de handoff y satisfaciendo el gate de cambio etapa 2+.

## Entregables

| Fase | Item | Estado |
|------|------|--------|
| **P1** | `POST /projects/:id/integration/promote-to-stage` | ✅ |
| **P1** | Wizard en `IntegrationPanel.tsx` (selección ítems, nombre etapa) | ✅ |
| **P1** | `promote-handoff.util.ts` + spec | ✅ |
| **P1** | Handoff import → `handoffImportedAt` / `handoffSnapshot` en Stage | ✅ |
| **P1** | Gate legacy: handoff import cuenta como cambio válido (`isLegacyChangeGateSatisfied`) | ✅ |
| **P1.1** | `POST …/stages/:stageId/reconcile-handoff` (Ariadne wire + `legacy/start` retroactivo) | ✅ |
| **P1.2** | `POST …/stages/:stageId/abandon-handoff` (archivar etapa + liberar NEW-LEG) + `abandon-handoff.util.ts` + spec | ✅ |
| **P1.2** | Botón **Revertir promoción** en `IntegrationPanel.tsx` | ✅ |

## Flujo usuario

1. Proyecto LEGACY enlazado a NEW (pestaña **Integración**).
2. NEW envía handoff (`POST …/handoff/send`).
3. LEGACY importa o promueve: wizard **Promover a etapa** crea Stage, copia handoff, activa etapa.
4. Etapa 2+ puede generar MDD / entregables (gate satisfecho por handoff). Tras promote/import, la API ejecuta **`legacy/start`** si `LEGACY_HANDOFF_AUTO_LEGACY_START` está activo. Etapas ya promovidas: **`POST …/integration/stages/:stageId/reconcile-handoff`** o botón **Re-sincronizar Ariadne** en Integración.

## Archivos

- `apps/api/src/modules/projects/integration/project-integration.service.ts`
- `apps/api/src/modules/projects/integration/project-integration.controller.ts`
- `apps/api/src/modules/projects/integration/promote-handoff.util.ts`
- `apps/web/src/components/IntegrationPanel.tsx`
- `packages/shared-types/src/project-integration.ts`

## API

```
POST /projects/:id/integration/promote-to-stage
Body: { name?, itemIds?, activate? }

POST /projects/:id/integration/stages/:stageId/reconcile-handoff
Body: { wireAriadne?, legacyStart? }   # retroactivo: Ariadne wire + legacy/start

POST /projects/:id/integration/stages/:stageId/abandon-handoff
Body: { reason?, rejectReleasedItems?, activateStageId? }
```

### abandon-handoff (revertir promoción)

- Solo LEGACY, etapa 2+ con handoff importado. Marca `workflowStatus: ARCHIVED`.
- Congela snapshot de entregables si falta; conserva `handoffSnapshot` + `abandonedAt`.
- Limpia `legacyStageId` en ítems NEW-LEG y en `IntegrationTrace`; libera ítems a `sent` (o `rejected`).
- Si la etapa era ACTIVE, activa etapa 1 baseline (o `activateStageId`). Enlace NEW↔LEGACY intacto.
- Recovery: abandon etapa N → corregir NEW-LEG → promote limpio a etapa N+1.

## Relacionado

- P0 brownfield: `docs/plans/PLAN-LEGACY-STAGE-P0-BROWNFIELD.md`
- Cross-project base: `docs/plans/PLAN-LEGACY-NEW-INTEGRATION.md`
