# store/workshop

Extracción incremental de `workshopStore.ts` (Fase 5a del [GOD-REFACTOR](../../../../docs/GOD-REFACTOR.md)).

## helpers/

Funciones puras sin dependencia del store Zustand.

| Archivo | Uso |
| ------- | --- |
| **pick-default-stage.ts** | `pickDefaultStageId` — elige etapa ACTIVE por ordinal o la de menor ordinal. |

Próximo: slices (`slice-project.ts`, `slice-mdd.ts`, …) y `index.ts` que compone `useWorkshopStore` con API idéntica.
