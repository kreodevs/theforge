# IntegrationPanel

Workshop tab for NEW ↔ LEGACY integration (`IntegrationPanel.tsx`).

## UX

1. **Enlazar proyectos** — picker dialog (`GET …/integration/picker`)
2. **NEW:** context AS-IS + handoff editor (crear/editar ítems vía `PATCH …/handoff/items/:id`) + send
3. **LEGACY:** **Nueva etapa desde integración** when `promotableItemIds` has SENT items (wizard: checkboxes, stage name, description preview)
4. **LEGACY:** **Importar handoff** on active stage 2+ (existing flow)
5. **Trace matrix** — NEW-LEG ↔ LEG; clic en NEW-LEG abre vista previa como historia de usuario (solo integración, no persiste en H.U. legacy hasta promover etapa)

## API

- Status: `GET /projects/:id/integration`
- Promote: `POST /projects/:id/integration/promote-to-stage`
- Import: `POST /projects/:id/integration/stages/:stageId/import-handoff`

Props: `projectId`, `projectType`, `activeStageId`, `activeStageOrdinal`, `onProjectRefresh`.
