# Plan de implementación: etapas (Stage) operables desde el Workshop

**Objetivo:** que el usuario pueda **elegir etapa**, **crear etapas** y **partir/clonar MDD** entre etapas, alineado con el modelo Prisma/API descrito en [STAGE-SDD.md](STAGE-SDD.md).

**Audiencia:** implementación (front + API). Estado revisado en código al **2026-03**.

**Implementado desde esta fecha:** `welcome` + `stageId`; streams MDD (`/mdd/stream`, manager, regenerate-section) y `GET /mdd/thread` con `stageId`; borrador en vivo / checkpoints `AgentStateCheckpoint` por `mddStageId`; store: `fetchWelcome`, `fetchProject`, `setActiveStageId` alineados; manual y checklist Fase 4 abajo.

---

## 1. Estado actual (auditoría)

### 1.1 Backend

| Pieza | Comportamiento |
|-------|------------------|
| `GET /projects/:id` | Incluye `stages` (orden por `ordinal`) **y** campos aplanados `mddContent`, `status`, `precisionScore`, `estimation` tomados de la etapa **primaria** vía `pickPrimaryStage` ([stage-helpers.ts](../apps/api/src/modules/projects/stage-helpers.ts)). |
| `PATCH /projects/:id` | Acepta `stageId` opcional + `mddContent` (y resto de campos de proyecto). Si `stageId` coincide con una etapa del proyecto, el MDD/semáforo/precisión se escriben en **esa** fila `Stage` ([projects.service.ts](../apps/api/src/modules/projects/projects.service.ts)). |
| Creación de etapas | Solo en **create project** (una etapa `main`) o **AgentSupervisor.ensurePrimaryStage** si un proyecto legacy no tenía filas ([agent-supervisor.service.ts](../apps/api/src/modules/agent-supervisor/agent-supervisor.service.ts)). **No hay** `POST /projects/:id/stages`. |
| Orquestador / chat | Resuelve **una** `stageId` por proyecto (`resolveRouteFromProject` → `pickPrimaryStage`). El cliente **no envía** `stageId` en welcome/chat/clear-chat. |
| Estimación / semáforo UI | `GET/POST .../ai-analysis/estimation` usa `getMddContentForProject` → **siempre** `pickPrimaryStage` ([estimation.service.ts](../apps/api/src/modules/ai-analysis/estimation/estimation.service.ts)). |
| Grafo SDD / ingest | Acotado por `stageId` en herramientas y sync cuando el backend conoce la etapa activa del flujo. |

### 1.2 Frontend (`apps/web`)

| Pieza | Comportamiento |
|-------|----------------|
| Tipo `Project` en [workshopStore.ts](../apps/web/src/store/workshopStore.ts) | **No** incluye `stages`; solo campos aplanados (`mddContent`, `status`, …). |
| `fetchProject` | Hace `GET /projects/:id` pero **descarta** el array `stages` del JSON (no se guarda en estado). |
| `PATCH` (persist MDD, etc.) | **No** envía `stageId`; todas las escrituras de MDD van a la etapa que el servidor considere primaria con el criterio actual. |
| UI | Sin selector, sin creación de etapa, sin clonado. |

**Conclusión:** los tres puntos que pide el producto (selector, nueva etapa, asistente de clonado) **no están implementados**; además **faltan endpoints y coherencia** en orquestador/estimación si el usuario pudiera cambiar de etapa sin que el servidor use la misma etapa en todos los sitios.

---

## 2. Brechas además de los 3 puntos explícitos

| # | Brecha | Impacto |
|---|--------|---------|
| A | **CRUD de etapas** inexistente en REST | No se puede “Nueva etapa” sin nuevo endpoint (o script Prisma). |
| B | **Una sola etapa “primaria”** para orquestador/estimación | Aunque el front envíe `stageId` en PATCH, el chat y el panel derecho seguirían usando la etapa de `pickPrimaryStage` hasta extender API. |
| C | **Hilo Manager** (`/ai-analysis/mdd/thread`) y streams MDD | Revisar si deben anclarse a `stageId` para no mezclar checkpoints entre etapas. |
| D | **Sesión / chat** | `Session` es por `projectId`; el historial no está particionado por etapa. Decisión de producto: ¿filtrar por etapa en el log, o un chat por etapa (más trabajo)? |
| E | **Tipos compartidos** | [projectResponseSchema](../packages/shared-types/src/project.ts) no describe `stages[]`; conviene tipar respuesta real o un DTO `ProjectWithStages`. |
| F | **Entregables a nivel proyecto** | Spec, Blueprint, etc. siguen en `Project`; multi-etapa implica reglas claras (¿mismos entregables globales para todas las etapas o por etapa en el futuro?). Para el MVP, mantener entregables globales y solo **MDD/semáforo/estimación** por etapa es lo ya modelado. |

---

## 3. Fases recomendadas

### Fase 0 — Contrato y reglas (corto)

- Definir **regla de foco**: una etapa con `workflowStatus = ACTIVE` por proyecto (o explícita `isPrimary` si se prefiere evitar ambigüedad). Alinear `pickPrimaryStage` con esa regla.
- Documentar en OpenAPI/README del módulo `projects` el shape de `GET /projects/:id` con `stages`.

### Fase 1 — API: crear y focalizar etapas

1. **`POST /projects/:projectId/stages`**  
   Body sugerido: `{ name?, key?, ordinal?, copyMddFromStageId? }`.  
   - Crea `Stage` con `workflowStatus` coherente (p. ej. nueva en `DRAFT` o `ACTIVE` según regla).  
   - Si `copyMddFromStageId`: copiar `mddContent`, y opcionalmente resetear semáforo o recalcular vía pipeline existente.

2. **`PATCH /projects/:projectId/stages/:stageId`** (o sub-recurso bajo `stages`)  
   - Campos: `workflowStatus`, `name`, `key`, `ordinal` (con validación de unicidad `(projectId, ordinal)`).  
   - Operación explícita **“activar esta etapa”**: poner esta `ACTIVE` y las demás en `SUPERSEDED`/`DRAFT` según decisión — para que `pickPrimaryStage` y orquestador coincidan con la UI.

3. **Opcional:** `DELETE` con restricciones (no borrar la única etapa; en cascada `EpisodicMemory`, etc.).

4. **Estimación / métricas:** extender `GET/POST .../projects/:id/ai-analysis/estimation` con query **`stageId`** (opcional). Si viene, `getMddContentForProject` debe leer MDD de esa etapa en lugar de solo `pickPrimaryStage`. Mantener compatibilidad sin query = comportamiento actual.

5. **Orquestador:** añadir **`stageId` opcional** en body de `welcome`, `chat`, `clear-chat` (y stream si aplica). `resolveRouteFromProject` debe usar la etapa indicada si es válida y pertenece al proyecto; si no, fallback a `pickPrimaryStage`.

### Fase 2 — Front: estado y selector

1. **Tipos:** extender el modelo de proyecto en el store con `stages: StageRow[]` (id, name, key, ordinal, workflowStatus, status, precisionScore, estimation resumida).

2. **Estado global:** `activeStageId` (sincronizado con la etapa ACTIVE del servidor tras `fetchProject`, o con la última selección del usuario).

3. **`fetchProject`:** persistir `stages` y, a partir de `activeStageId`, rellenar `mddContent` / semáforo / estimación mostrados **desde la etapa seleccionada** (o usar solo lo plano del API si el backend ya devuelve la etapa activa como “plano” — preferible **leer del stage elegido** cuando haya selector).

4. **Todas las llamadas que escriben MDD:** incluir **`stageId: activeStageId`** en `PATCH` (y en payloads de stream si el API lo exige en Fase 1).

5. **Selector en UI** (header del Workshop, junto a Ayuda / ZIP): dropdown con nombre + ordinal + estado; al cambiar, `fetchProject` o PATCH focalizar + refrescar panel central y métricas.

### Fase 3 — “Nueva etapa” y clonado

1. Botón **“Nueva etapa”** → modal (nombre, opcional clave; checkbox “Copiar MDD desde etapa actual” o selector de origen).  
2. Llama `POST /stages` y luego refresca proyecto; opcionalmente cambia foco a la nueva etapa.  
3. Texto de ayuda y [workshop-manual.md](../apps/web/src/content/workshop-manual.md) actualizados para reflejar comportamiento real.

### Fase 4 — Pulido y riesgos

- **Chat:** si se mantiene un solo hilo, mostrar badge “Etapa: X” en mensajes nuevos o banner al cambiar de etapa advirtiendo que el historial es global.  
- **Pruebas:** e2e mínimo — crear etapa, cambiar foco, editar MDD, verificar semáforo distinto por etapa.  
- **Rendimiento:** `findOne` ya trae `stages`; vigilar tamaño de respuesta si hay muchas etapas.

---

## 4. Orden sugerido de tareas (checklist)

- [x] Fase 0: regla de etapa activa + documentación API (parcial; ver `STAGE-SDD` / README módulos)  
- [x] Fase 1.1: `POST /projects/:id/stages` (+ copia MDD opcional)  
- [x] Fase 1.2: `PATCH .../stages/:id` + activación exclusiva  
- [x] Fase 1.3: `estimation?stageId=` + orquestador con `stageId` (welcome/chat; streams MDD con borrador por etapa)  
- [x] Fase 2: store + selector + PATCH con `stageId`  
- [x] Fase 3: modal Nueva etapa + clonado  
- [x] Fase 4: UX chat (badge/banner etapa); manual (`workshop-manual.md` checklist)  

---

## 5. Referencias

- [STAGE-SDD.md](STAGE-SDD.md) — modelo Stage, API aplanada, Falkor.  
- [MCP-ARQUITECTURA-MAXPRIME.md](MCP-ARQUITECTURA-MAXPRIME.md) — consultas `stageId` en grafo SDD.  
- Código: [projects.service.ts](../apps/api/src/modules/projects/projects.service.ts), [stage-helpers.ts](../apps/api/src/modules/projects/stage-helpers.ts), [workshopStore.ts](../apps/web/src/store/workshopStore.ts).
