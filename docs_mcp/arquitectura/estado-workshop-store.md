---
id: estado-workshop-store
title: Estado del Workshop (Zustand)
category: Arquitectura
last_updated: 2026-06-29
---

# Estado del Workshop (`workshopStore`)

> **AI Context Brief:** Único store global (Zustand) de la web de The Forge; mantiene el proyecto activo, entregables, etapas, chat, streaming y métricas del semáforo. Léelo antes de añadir estado de feature.

## 1. Uso Básico (Quick Start)

```typescript
import { useWorkshopStore } from "@/store/workshopStore";

// Leer estado:
const project = useWorkshopStore((s) => s.project);
const activeStageId = useWorkshopStore((s) => s.activeStageId);

// Acciones:
const fetchProject = useWorkshopStore((s) => s.fetchProject);
const sendMessage = useWorkshopStore((s) => s.sendMessage);
await fetchProject(projectId);
```

## 2. API & Contrato de Tipos (Specs)

| Elemento                          | Detalle                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| Store                             | `useWorkshopStore` (`apps/web/src/store/workshopStore.ts`).             |
| Proyecto + entregables aplanados  | `project`, `mddContent`, `specContent`, `handoffSpecContent`, …          |
| Etapas                            | `workshopStages`, `activeStageId`, `patchWorkshopStage`.                |
| Chat / streaming                  | `session`, estado de streaming, `sendMessage`.                          |
| Métricas                          | `liveMetrics` (semáforo + costo), `conformance`.                        |
| Selectores                        | `selectWorkshopAgentsBusy`, `selectPersistedMddBaseline`.               |
| Tipos                             | `Project`, `WorkshopStage`, `Status`, `LiveMetricsResult`.              |
| Hook derivado                     | `apps/web/src/hooks/useInterview.ts` (selector para la pestaña de chat).|

**Context React:** solo `ThemeProvider` (tema). No hay context global de datos.

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** Es el **único** store Zustand del frontend; no crees stores paralelos para estado del Workshop. Si una feature necesita estado, extiende este store o usa estado local del componente.
- **Regla 2:** Los entregables del proyecto viven **aplanados** en el store (`mddContent`, `handoffSpecContent`, …); persiste con las acciones del store, no mutando el objeto.
- **Regla 3:** El color del semáforo vivo viene de `liveMetrics.status` (API de estimación), no se calcula en el cliente.
- **Regla 4:** Selecciona slices con selectores (`useWorkshopStore((s) => s.x)`) para evitar renders innecesarios.
