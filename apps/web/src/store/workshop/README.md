# store/workshop

Extracción incremental de `workshopStore.ts` (Fase 5a del [GOD-REFACTOR](../../../../docs/GOD-REFACTOR.md)).

## Estructura

| Archivo / carpeta | Rol |
| ----------------- | --- |
| **types.ts** | Tipos de dominio exportados (`Project`, `WorkshopStage`, `LegacyFlowState`, …). |
| **workshop-state.types.ts** | Interfaz `WorkshopState` (estado + acciones). |
| **initial-state.ts** | `workshopInitialState` — valores por defecto del store. |
| **selectors.ts** | `selectWorkshopAgentsBusy`, `selectPersistedMddBaseline`, `isMddEditorDirty`. |
| **slice-ui.ts** | `createUiSlice` — setters de UI (loading, error, notice, modales, legacy debug). |
| **slice-project.ts** | `createProjectSlice` — proyecto, etapas, `fetchProject`, plugin data. |
| **slice-session-chat.ts** | `createSessionChatSlice` — sesión, chat, `/formatear`, `sendMessage`. |
| **slice-mdd.ts** | `createMddSlice` — editor MDD, persist, jobs benchmark/upstream, review/format. |
| **slice-deliverables.ts** | `createDeliverablesSlice` — entregables (UX, Blueprint, API, …), cascada, conformance, Phase 0, estimación. |
| **helpers/persist-field.ts** | `persistField` — PATCH genérico de entregables (usado por chat y store). |
| **helpers/agent-progress-patch.ts** | `patchAgentProgressFromMddEvent` — progreso MDD en stream. |
| **helpers/** | Funciones puras sin Zustand (ver tabla abajo). |

`workshopStore.ts` compone `createUiSlice` + acciones de dominio y re-exporta tipos/selectores para no romper `@/store/workshopStore`.

## helpers/

| Archivo | Uso |
| ------- | --- |
| **pick-default-stage.ts** | `pickDefaultStageId` — etapa ACTIVE o menor ordinal. |
| **workshop-scope.ts** | `workshopScopeProjectId`, `shouldApplyWorkshopUpdate`. |
| **store-errors.ts** | Errores de fetch/stream amigables (`friendlyFetchError`, `streamErrorPatch`, …). |
| **delivery-gate.ts** | Gate MDD ≥9/10 desde eventos SSE. |
| **generation-status.ts** | Polling de `generation-status` + merge upstream sync. |
| **mdd-editor.ts** | Baseline MDD, persist desde stream, cola `enqueueMddPersist`. |
| **stage-focus.ts** | Alinear store con etapa activa (`workshopStateFromProjectStage`, …). |
| **session-message.ts** | `sessionMessageBody`, helpers de chat MDD. |
| **clarified-field-patch.ts** | Parche de campo tras clarificar documento. |

Próximo: `slice-legacy-debug`, `slice-clarify`.
