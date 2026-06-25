# Project integration (NEW ↔ LEGACY)

Cross-project handoff, trace matrix, and stage promotion for brownfield SDD.

## Endpoints (`ProjectIntegrationController`)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/projects/:projectId/integration` | Status, warnings, traces, `promotableItemIds` (LEGACY) |
| `PATCH` | `/projects/:projectId/integration/link` | Bidirectional NEW ↔ LEGACY link |
| `POST` | `/projects/:projectId/integration/handoff/send` | NEW: draft → sent |
| `POST` | `/projects/:projectId/integration/stages/:stageId/import-handoff` | LEGACY: import into existing stage 2+ |
| `POST` | `/projects/:projectId/integration/stages/:stageId/reconcile-handoff` | LEGACY: retroactive Ariadne wire + `legacy/start` on imported stage |
| `POST` | `/projects/:projectId/integration/stages/:stageId/abandon-handoff` | LEGACY: archive stage + release NEW-LEG for re-promotion |
| `POST` | `/projects/:projectId/integration/promote-to-stage` | **P1:** create stage from SENT handoff batch |
| `POST` | `/projects/:projectId/integration/stages/:stageId/sync-handoff-spec` | **IntegrationAgent:** (re)generate `handoff-spec.md` for a stage |
| `POST` | `/projects/:projectId/integration/sync-handoff-spec` | **IntegrationAgent:** same for the primary (active) stage |

## Promote to stage (hybrid C+B)

Body (`promoteHandoffToStageBodySchema` in `@theforge/shared-types`):

```json
{ "itemIds": ["NEW-LEG-01"], "stageName": "Integración — Microservicio X", "activate": true }
```

- LEGACY only; requires `linkedNewProjectId`
- Default items: SENT traces without `legacyStageId`, else all SENT
- Creates stage via `ProjectsService.createStage`, applies `handoffSnapshot` + `legacyChangeState.description` (`buildHandoffImportDescription`)
- After import/promote: **`legacy/start`** (Ariadne `get_modification_plan`) when `LEGACY_HANDOFF_AUTO_LEGACY_START` is enabled (default)
- **Retroactive:** `POST …/stages/:stageId/reconcile-handoff` with `{ wireAriadne?, legacyStart? }` (default both true) — for stages promoted before auto-start or failed wire/analyze

## Reconcile handoff (retroactive)

Body (`reconcileHandoffStageBodySchema`):

```json
{ "wireAriadne": true, "legacyStart": true }
```

- LEGACY only; stage must already have `handoffImportedAt` or `handoffSnapshot`
- Awaits `wireAriadneBrownfieldConverge` (PATCH `theforgeStageId` on Ariadne repos) then `legacy/start` using persisted handoff description
- Does not re-import handoff from NEW (no duplicate description merge)

## Abandon handoff (revert promotion)

Body (`abandonIntegrationHandoffBodySchema`):

```json
{ "reason": "alcance mal definido", "rejectReleasedItems": false, "activateStageId": "…" }
```

- LEGACY only; stage 2+ with imported handoff; sets `workflowStatus: ARCHIVED` (visible in Workshop selector)
- Freezes deliverables snapshot if missing; keeps `handoffSnapshot` + `abandonedAt` for audit
- Clears `legacyStageId` on NEW handoff items and `IntegrationTrace` rows
- Released items → `sent` (re-editable / re-promotable) or `rejected` if `rejectReleasedItems`
- If abandoning ACTIVE stage, activates etapa 1 baseline (or `activateStageId`)

## IntegrationAgent — handoff-spec.md (dynamic)

`integration-agent.service.ts` (`IntegrationAgentService`) turns the registered NEW-LEG items into a dynamic **`handoff-spec.md`** (Brownfield technical breakdown), persisted as `Stage.handoffSpecContent` (flattened to Project like other deliverables) and shown in the Workshop **Handoff Spec** tab.

- **Governance ("Regla de Oro"):** only structures/deepens existing items; never creates handoff items.
- **Plan-then-Execute redactor:** `apps/api/src/modules/ai-analysis/nodes/integration-agent.node.ts` (`runIntegrationAgent`) — probes the LEGACY graph per item (`validate_before_edit` / `semantic_search`) and synthesizes the doc against MDD §3 (Model) / §4 (API).
- **Prompt:** `apps/api/src/modules/ai/prompts/integration-agent-prompt.md`.
- **Manager hook (prepared):** `ai-analysis/utils/integration-intent.util.ts` (`detectLegacyIntegrationIntent`) — the MDD Manager suggests running the sync when it detects a legacy-integration message (it does not call the service inline, to avoid a circular module dependency).

## Helpers

- `integration-context.util.ts` — prompt blocks, `parseSatisfiesLinksFromUserStories`
- `promote-handoff.util.ts` — item selection for promote (unit-tested)
- `reconcile-handoff.util.ts` — resolve description from stage snapshot (unit-tested)
- `abandon-handoff.util.ts` — release items + pick stage to activate (unit-tested)

See `docs/plans/PLAN-INTEGRATION-AS-STAGE.md`.
