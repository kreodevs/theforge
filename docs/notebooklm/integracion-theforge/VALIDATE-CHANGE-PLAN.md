# validate_change_plan — Gate 2 (The Forge ↔ Ariadne)

Canonical contract: Ariadne `docs/contracts/change-plan-validation-v1.md`.

## The Forge

| Piece | Location |
|-------|----------|
| Types + extractor | `packages/shared-types/src/change-plan/` |
| MCP client | `TheForgeService.validateChangePlan` |
| Service | `apps/api/src/modules/projects/plan-validation.service.ts` |
| REST | `POST /projects/:id/validate-change-plan`, `GET …/plan-validation` |
| Auto after Tasks | `ProjectsService.generateTasks` when `theforgeProjectId` set |
| Workshop UI | `WorkshopMetricsColumnInner` — **Plan Ariadne** |
| Help | `apps/web/src/content/help/validacion-plan-ariadne.md` |

## Ariadne

| Piece | Location |
|-------|----------|
| Ingest | `POST /projects/:id/validate-change-plan` |
| Service | `services/ingest/src/plan-validation/` |
| MCP tool | `validate_change_plan` in `services/mcp-ariadne` |

## Cursor flow

1. `get_modification_plan` (Gate 1)
2. Implement / generate tasks
3. `validate_change_plan` with `ChangePlan` JSON
4. `validate_before_edit` per file
