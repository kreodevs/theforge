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

Próximo: slices de dominio (`slice-project`, `slice-mdd`, `slice-deliverables`, …) y `index.ts` fino.
