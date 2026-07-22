# Tasks en el SDD de The Forge — rol, lectura e implementación

Guía para equipos y agentes (Cursor, Claude, Copilot, etc.) sobre **qué es** el documento Tasks, **cómo se relaciona** con el resto de entregables y **cuándo** hace falta leer cada artefacto.

Relacionado: [THEFORGE-DOC-CONSUMPTION-GUIDE.md](./THEFORGE-DOC-CONSUMPTION-GUIDE.md), [THE-FORGE-V1-RELEASE.md](./THE-FORGE-V1-RELEASE.md) §1.

---

## Resumen

| Pregunta | Respuesta corta |
|----------|-----------------|
| ¿Sin Tasks el agente lee todo? | Sí — tendría que sintetizar MDD, Spec, API, Blueprint, flujos, pantallas, etc. |
| ¿Con Tasks los otros documentos sobran? | **No** — Tasks es el **itinerario**; MDD y contratos siguen siendo **fuente de verdad**. |
| ¿Quién manda si hay conflicto? | **MDD** (constitución §1–§7), luego contratos API vinculantes, luego `pantallas.md` sobre Blueprint §8. |
| ¿Qué hace The Forge al generar Tasks? | Destila upstream en checklist con trazabilidad `MDD:` / `Story:`, YAML v2, cobertura §1–§7 y métrica **TaskAccuracy ≥ 90**. |

---

## 1. Por qué existe Tasks

The Forge genera ~11 entregables SDD en oleadas (greenfield) o en paralelo planificado (legacy). Cada uno cubre una capa:

- **MDD** — constitución técnica (stack, datos, API, seguridad, infra).
- **Spec / HU** — qué construir y criterios de aceptación.
- **Blueprint / Architecture** — plan de implementación y módulos.
- **API / Flujos / Infra** — contratos y comportamiento detallado.
- **Pantallas / Design system** — UI concreta (componentes, rutas, binding).

Un agente que implementa código **sin** Tasks debe **leer y cruzar** todos esos documentos en cada sesión para inferir orden, alcance y detalle. Eso es lento, caro en tokens y propenso a omisiones.

**Tasks** es la **compresión ejecutable**: lista priorizada de ítems comprobables (`- [ ]`), con secciones Backend / Frontend / Infra, trazabilidad al MDD y (en brownfield) coordenadas de archivo cuando hay repo indexado en Ariadne.

The Forge lo produce en **W3** de la cascada HIGH (tras Spec, API, Blueprint, pantallas, etc.) y puede **reintentarse en W4** si `TaskAccuracy < 90`.

---

## 2. Con Tasks: ¿los otros documentos importan?

**Sí, siempre.** La guía de consumo del handoff lo define así:

> Úsalo como checklist, pero **no** como única fuente — contrasta siempre contra MDD y Blueprint.

### Roles por artefacto

| Documento | Rol para el agente implementador |
|-----------|----------------------------------|
| **MDD** | Constitución: entidades §3, endpoints §4, seguridad §6, stack §2, patrones `[X]` del wizard |
| **Spec / User Stories** | Qué y por qué; criterios de aceptación y checkpoints por story |
| **Blueprint / Architecture** | Estructura de módulos, fases, convenciones |
| **API contracts** | **Vinculante** — paths, métodos, DTOs, códigos HTTP |
| **Logic flows** | Flujos multi-paso (auth, pagos, sagas, HITL) |
| **pantallas.md** | **Gana** sobre heurísticas Blueprint §8 para UI (componentes reales + binding) |
| **design-system / ux-ui-guide** | Tokens, tipografía, componentes autorizados |
| **Tasks** | **Qué hacer ahora**, en qué orden, con punteros a lo anterior |

### Prioridad ante conflictos

1. **MDD** §2–§6  
2. **API contracts** (si existen)  
3. **pantallas.md** > Blueprint §8 para UI  
4. **Tasks** — si contradice MDD/API, **gana el upstream**; documentar en `docs/sdd/PROGRESO.md`

---

## 3. Flujo de trabajo recomendado (handoff)

Orden canónico en spec-kit (ver `buildTheforgeDocConsumptionGuide`):

1. `IMPLEMENT.md` + gobernanza (`AGENTS.md`, rules/skills).
2. `.specify/memory/constitution.md` (MDD).
3. Spec, architecture, user stories.
4. Blueprint / plan.
5. Design system + **pantallas.md** (antes de UI).
6. API contracts + logic flows.
7. **`tasks.md`** — checklist de ejecución.
8. Infra, ADRs, quickstart.

### Por sesión de implementación

```text
1. Leer la tarea activa (T-NNN o ítem `- [ ]` en tasks.md).
2. Resolver detalle en el artefacto citado:
   - entidad / migración → MDD §3
   - endpoint → api-contracts.md
   - pantalla → pantallas.md (+ design-system)
   - flujo → logic-flows.md
   - patrón arquitectónico → wizard [X] en MDD
3. Implementar y verificar (verification del YAML v2 si existe).
4. Marcar ítem en tasks.md y docs/sdd/PROGRESO.md.
```

Con Tasks **bien generados**, el agente **no relee** los 11 documentos enteros cada vez: avanza tarea a tarea y **consulta** el artefacto correcto bajo demanda.

Con Tasks **incompletos o genéricos**, vuelve el escenario sin Tasks: hay que leer y cruzar upstream manualmente.

---

## 4. Analogía

- **MDD + Spec + API + Blueprint** = planos y normativa del edificio.  
- **Tasks** = lista de obra (“hoy: losa planta 2; ver plano eléctrico p.12”).  
- El equipo no tira los planos porque tiene la lista; la lista **remite** a los planos cuando hace falta detalle.

---

## 5. Cómo The Forge asegura calidad en Tasks

Pipeline: `TasksGenerationPipelineService` → `ProjectsService.generateTasks`:

1. **Pre-flight** (`tasks-preflight.util.ts`) — bloquea si MDD vacío o DocAccuracy &lt; 70; **70–89** → warning y continúa; C4 (pantallas) solo exige `uiScreens` con `hasUxTeam`; `?acknowledgeGaps=true` relaja gate MDD. Antes del LLM, **`ensureTasksUpstreamArtifacts`** normaliza Spec, sync pantallas y regenera API/flujos vacíos (`tasks-upstream-prep.util.ts`).
2. **Tasks Planner** — JSON de plan (`T-001`…) con modelo **auditor/planner**; fallback heurístico **1 ítem por endpoint**.
3. **Redactor** — `AiService.generateTasks` con plan JSON, Use Cases, caps ampliados API/pantallas y **`max_tokens` perfil `tasksDoc` (131K)**.
4. **Tasks Auditor LLM** — score ≥ 92, con extractos API/pantallas y **checklist determinista** (`tasks-coverage-checklist.util.ts`).
5. **Gates deterministas** — cobertura bijectiva endpoint↔task y ruta↔Frontend; secciones Testing/Deploy; `TaskAccuracy` + `task-auditor` v2 (`mdd_ref` / `story_ref` obligatorios en implementación).
6. **Reparación** — hasta 2 ciclos (3 si documento truncado) con feedback combinado (Auditor LLM + gates).
7. **W4 cascada** — reintento Tasks con `acknowledgeGaps` solo si DocAccuracy upstream &lt; 70.

Configuración: **Ajustes → Editar instancia → Modelo auditor / planner** (vacío = modelo de chat). Combos OpenRouter y tuning de tiempo: [TASKS-OPENROUTER-MODELS.md](./TASKS-OPENROUTER-MODELS.md).

Persistencia: `cleanDocumentContent` + auto-parse a `tasksJson` (Tasks v2).

---

## 6. Brownfield (legacy)

- Tasks puede incluir **coordenadas exactas** desde ChangeScope + mapa Ariadne.
- Sigue siendo checklist; el MDD y el grafo del cambio acotan el scope.
- Tras generar Tasks con `theforgeProjectId`, puede ejecutarse **Gate 2** (`validate_change_plan`).

---

## 7. Qué no hace Tasks

- No sustituye contratos API ni el modelo de datos del MDD.
- No autoriza inventar endpoints, entidades o librerías fuera del stack §2.
- No elimina la necesidad de leer pantallas/API cuando la tarea lo exige.
- No reemplaza el chat Manager del MDD (refino constitucional es otro flujo).

---

## 8. Referencias en código

| Tema | Ubicación |
|------|-----------|
| Prompt Tasks | `apps/api/src/modules/ai/prompts/tasks-prompt.md` |
| Generación | `apps/api/src/modules/ai/ai.service.ts` → `generateTasks` |
| Orquestación + QA | `apps/api/src/modules/projects/projects.service.ts` → `generateTasks` |
| Calidad post-gen | `apps/api/src/modules/projects/tasks-generation-quality.util.ts` |
| TaskAccuracy | `apps/api/src/modules/engine/cascade-accuracy.util.ts` |
| Auditor Tasks v2 | `apps/api/src/modules/engine/task-v2/task-auditor.ts` |
| Guía consumo | `packages/shared-types/src/doc-consumption-guide.ts` |
| Handoff | `apps/api/src/modules/projects/handoff-export.util.ts` |

---

*Mantener alineado con `THEFORGE-DOC-CONSUMPTION-GUIDE.md` y `CHANGELOG.md` cuando cambie el pipeline de Tasks.*
