# Plan de implementación: BRD, Manual To-Be y As-Is en The Forge

Documento de trabajo para integrar **fases previas al MDD** (BRD + Manual To-Be en greenfield; As-Is + BRD/To-Be antes del MDD de cambio en legacy), alineado con el stack actual (NestJS, Prisma, FalkorDB, `AgentSupervisorService`, `AiOrchestratorService`, `LegacyCoordinatorService`, MCP Ariadne/TheForge).

**Estado:** planificación — ejecutar por fases; no es obligatorio cerrar todo en un solo sprint.

---

## 0. Objetivo y principios

| Objetivo             | Descripción                                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Greenfield**       | Tras la entrevista proactiva, el sistema recoge **BRD** (problema, KPIs, alcance de negocio) y **Manual To-Be** (lógica deseada, diagramas de negocio) **antes** de autorizar redacción técnica del MDD §1–§7.           |
| **Legacy**           | Nutrir **As-Is** desde evidencia MCP (`ask_codebase`, `semantic_search`, grafo); definir **BRD de cambio** + **To-Be**; luego sintetizar **MDD de cambio** cruzando evidencia + reglas.                                  |
| **Anti-alucinación** | Reutilizar el patrón “**no LLM sin insumo mínimo**” (ej. casos de uso sin MDD en `AiService.generateUseCases`): **gates** explícitos antes de Manager MDD / pipeline LangGraph y antes de cascada legacy de entregables. |

**Principio YAGNI:** versionar BRD/To-Be como markdown + estado de aprobación antes de modelar grafos ricos; ampliar Falkor cuando el flujo HITL esté estable.

---

## 1. Modelo de datos (PostgreSQL + Prisma)

**Archivo base:** `packages/database/schema.prisma` (`Stage`, `Project`, `legacyFlowState` Json).

### 1.1 Opción A (recomendada inicial): campos en `Stage`

- `brdContent String? @db.Text` — BRD (markdown).
- `toBeManualContent String? @db.Text` — Manual To-Be (markdown).
- `asIsManualContent String? @db.Text` — opcional; útil en etapas legacy o “proceso actual”.
- `brdApprovedAt DateTime?`, `toBeApprovedAt DateTime?` — validación cliente (HITL).
- Opcional: `brdStatus` / `toBeStatus` enum (`DRAFT | SUBMITTED | APPROVED`) si no bastan timestamps.

**Ventaja:** ya existe la noción de “constitución por etapa” (`Stage.mddContent`); BRD/To-Be son **precursor** de la misma etapa o de la etapa previa según `ordinal`/`key`.

---

## 2. Flujo Greenfield (proyectos nuevos)

### 2.1 Orquestación de chat

**Piezas actuales:** `AgentSupervisorService` (ruta por proyecto/etapa), `AiOrchestratorService.welcome`, streaming Manager en `AiAnalysisController` (`POST ai-analysis/mdd/stream/manager`), pipeline `AiAnalysisService.streamMddAnalysis` / grafo LangGraph.

**Cambios conceptuales:**

1. **Nueva “fase de ruta” o `activeTab` / `contextStep`** (según diseño UI): entrevista enfocada a **BRD** y luego **To-Be**, sin saltar a entidades técnicas hasta gate pasado.
2. **System prompts / grafo Manager:** primeros nodos o instrucciones del Manager recogen **problema, KPIs, diagramas lógicos de negocio** (plantillas markdown fijas para consistencia y parsing posterior a Falkor).
3. **Guardarraíl:** antes de invocar nodos que redactan **§3 modelo / §4 API** (o el Manager equivalente), comprobar:
   - `brdContent` no vacío y `brdApprovedAt` no null (o estado `APPROVED`).
   - `toBeManualContent` no vacío y `toBeApprovedAt` no null.
   - Si falla → respuesta HTTP 400 o evento NDJSON `blocked` con mensaje claro (sin llamada LLM de síntesis técnica).

**Referencias de patrón:** bloqueo lógico similar a legacy sin MDD para use cases; aplicar en **Manager stream** y, si aplica, en `streamMddAnalysis` entrada.

### 2.2 Transición al MDD

- Tras aprobación: construir **bloque de contexto reforzado** (prepend al user message o `shortTermContext` en `Stage`) con resúmenes/secciones BRD + To-Be.
- **Síntesis MDD:** primera generación o actualización del MDD de 7 secciones usa DBGA/Benchmark **más** BRD + To-Be aprobados (orden documentado en prompt).

### 2.3 UI (web)

- Pestañas o pasos Workshop: **BRD → To-Be → MDD** con botones “Enviar a revisión” / “Aprobar”.
- Indicadores de bloqueo en tab MDD hasta cumplir gates (mensaje alineado con API `blocked`).

---

## 3. Flujo Legacy

### 3.1 As-Is automatizado

- **Entrada:** MCP ya usado en `LegacyCoordinatorService` / `TheForgeService` (`ask_codebase`, `semantic_search`, evidencia en `codebaseDoc` / rollup MDD).
- **Producto:** persistir **As-Is** en `Stage.asIsManualContent` o en `legacyFlowState` (clave explícita `asIsManual`) generado/asistido por LLM **solo** si hay evidencia suficiente (longitud mínima / citas de rutas).
- **Paso 1 manual de procesos:** plantilla markdown “Mapa As-Is” rellenada desde herramientas + opción de edición humana.

### 3.2 BRD + To-Be antes del MDD de cambio

- **UI / API legacy:** flujos `generate-mdd` / entregables: exigir BRD + To-Be aprobados (o flags en `legacyFlowState`) **antes** de `generate-mdd` que produce constitución de cambio.
- **Guardarraíl índice/SDD:** mantener y **documentar orden** respecto a BRD/To-Be:
  - `assertLegacyIndexSddGate` (`legacy-coordinator.service.ts`) sigue siendo la puerta índice ↔ grafo SDD.
  - Añadir mensajes cuando el índice esté vacío o haya mismatch: **antes** de invitar a To-Be detallado, el usuario debe resolver 409 o completar codebase doc.

### 3.3 MDD de cambio

- Prompt de `generateMdd` / rollup: inyectar **As-Is + BRD + To-Be aprobados** + evidencia indexada.
- Objetivo: MDD de cambio con trazabilidad explícita “decisión To-Be → impacto en §3/§4”.

---

## 4. FalkorDB y semáforo SDD

**Servicio actual:** `GraphMemoryService.evaluateSddDependencyHealth` (usado p. ej. desde `mdd-update-pipeline.service.ts`).

### 4.1 Fase 1 (valor rápido)

- Al aprobar BRD: job o paso sincronizado que **parsea** objetivos/KPIs (regex o LLM estructurado **acotado**) y escribe nodos/relaciones en Falkor con prefijo estable (`BusinessObjective`, `KPI`, `links_to_stage`).
- Documentar esquema de nodos/aristas en `docs/STAGE-SDD.md` o nuevo doc de grafo BRD.

### 4.2 Fase 2 (semáforo)

- Extender `evaluateSddDependencyHealth` (o capa previa) para comprobar cadena:
  - `BusinessObjective` → requisito To-Be → entidad/API en MDD ingerido.
- Fallos → contribuir a **ROJO** / warnings con texto accionable en Workshop.

**Riesgo:** duplicar fuente de verdad entre markdown y grafo; mitigar con “ingesta idempotente” desde el markdown aprobado (versionado por `updatedAt`).

---

## 5. Orden de implementación sugerido (incremental)

| Fase   | Entrega                                                                      | Criterio de “hecho”                           |
| ------ | ---------------------------------------------------------------------------- | --------------------------------------------- |
| **G0** | Prisma: campos BRD/To-Be/(As-Is) + migración; PATCH API mínimo por `stageId` | Datos persisten y se leen en Workshop         |
| **G1** | Gates en Manager stream + mensajes sin LLM técnico si faltan aprobaciones    | 400/`blocked` reproducible en tests manuales  |
| **G2** | Prompts: inyección BRD+To-Be en primera síntesis MDD                         | MDD generado referencia secciones BRD/To-Be   |
| **L1** | `legacyFlowState` o `Stage` legacy: BRD/To-Be + UI legacy                    | Usuario no genera MDD de cambio sin completar |
| **L2** | As-Is asistido desde MCP en paso dedicado                                    | `asIsManual` poblado con citas                |
| **F1** | Ingesta Falkor desde BRD aprobado                                            | Nodos consultables por Cypher                 |
| **F2** | Semáforo / `evaluateSddDependencyHealth` extendido                           | ROJO si falta enlace BRD→MDD                  |

---

## 6. Riesgos y decisiones pendientes

- **Duplicidad BRD vs DBGA:** clarificar si BRD sustituye parte de Fase 0 o convive; evitar tres fuentes sin jerarquía.
- **Legacy vs Stage:** hoy mucho legacy vive en `Project` + `legacyFlowState`; decidir si BRD/To-Be van a **Stage** `isLegacy` o solo a JSON legacy para el primer MVP.
- **Coste LLM:** As-Is + BRD + To-Be añaden pasos; reutilizar rollup/throttle ya existente en legacy entregables donde aplique.
- **Privacidad:** BRD puede contener datos sensibles; mismas políticas de almacenamiento que `mddContent`.

---

## 7. Referencias rápidas en repo

- Manager MDD (nuevo): `apps/api/src/modules/ai-analysis/ai-analysis.controller.ts` (`streamMddManager`), `ai-analysis.service.ts` (`streamMddAnalysis`, contexto por `AgentSupervisor`).
- Legacy: `apps/api/src/modules/legacy-flow/legacy-coordinator.service.ts` (`assertLegacyIndexSddGate`, `generateDeliverables`, rollup MDD).
- Grafo / salud SDD: `apps/api/src/modules/ai-analysis/graph-memory/graph-memory.service.ts` (`evaluateSddDependencyHealth`).
- Esquema etapa: `packages/database/schema.prisma` (`Stage`, `Project`).

---

_Última actualización: plan guardado para ejecución por fases; ajustar prioridades según negocio (p. ej. L1 antes de F1 si Falkor puede esperar)._
