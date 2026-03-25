# Módulo Legacy Flow

Flujo separado para **proyectos legacy** (documentados en TheForge): modificaciones sin Paso 0, con coordinador, revisor y cascada de entregables.

## Endpoints

- `POST /projects/:projectId/legacy/generate-codebase-doc` — Genera documentación de partida del codebase vía MCP (opcional, ideal como primer paso). Persiste en `legacyFlowState.codebaseDoc`. Devuelve `{ codebaseDoc }` o `null` si TheForge no está configurado.
- `PATCH /projects/:projectId/legacy/codebase-doc` — body `{ codebaseDoc?: string }`. Actualiza la documentación de partida (edición manual). Devuelve `{ codebaseDoc }`.
- `POST /projects/:projectId/legacy/start` — body `{ description: string }`. Llama a TheForge **`get_modification_plan`** (SPEC-MCP-001); si no está disponible, fallback a `ask_codebase`. Devuelve `{ filesToModify, questions }` y persiste en `legacyFlowState`.
- `POST /projects/:projectId/legacy/answer` — body `{ answers: Record<string, string> }`. Guarda respuestas del usuario.
- `POST /projects/:projectId/legacy/generate-mdd` — Genera el MDD de cambio (coordinador + revisor) y persiste en `mddContent`. Usa varias consultas a TheForge (qué existe, arquitectura, reglas) y exige al LLM inferir impacto completo en módulos/entidades/UI, no solo el requerimiento literal.
- `POST /projects/:projectId/legacy/generate-deliverables` — Despacho dinámico según `Project.complexity`: solo los pasos en `DELIVERABLES_BY_COMPLEXITY`, con contexto TheForge inyectado. **Fuente:** `mddContent` (MDD de cambio) o, si está vacío, `legacyFlowState.codebaseDoc` (MDD Inicial → ingeniería inversa). Si hay `complexityPending` sin confirmar, 400.

## Servicios

- **LegacyCoordinatorService:** Orquesta start (TheForge), answer, generateMdd, generateDeliverables. Usa knowledge pack y AiService para generación. En legacy, **prioriza TheForge** con pipeline **evidencia-primero** (default, `LEGACY_EVIDENCE_FIRST_CONTEXT`): `semantic_search` → extracción de rutas → `get_functions_in_file` → `get_file_content` en prioritarios → resumen vía `ask_codebase` acotado a la evidencia (`twoPhase: true` en el cliente). Si desactivas el flag, vuelve el modo clásico (varias preguntas NL + semántica). `generateMdd` antepone un bloque de evidencia del índice (misma util) además de validación por archivo, definiciones y extractos. `getContextForDeliverables` reutiliza el mismo pipeline. Límite de contexto en prompts: `LEGACY_MDD_THEFORGE_CONTEXT_MAX_CHARS` (default 24000). Ver `../theforge/README.md` y `.env.example`.
- **LegacyReviewerService:** Revisa lista archivos/preguntas y borrador MDD. Si el MDD casi no cita rutas (menos de 3 referencias tipo `archivo.ts`), antepone aviso SDD al prompt de revisión.

## Conocimiento

Carpeta `knowledge/`: contenido derivado de los 3 cuadernos NotebookLM (Arquitectura de Prompts, Specification-Driven Development, Architecting Agentic Systems). Se carga en runtime con `loadLegacyKnowledgePack()` e se inyecta en los prompts del coordinador y revisor.

## Dependencias

- TheForgeService (getModificationPlan preferido para start; askCodebase para contexto MDD y sugerencias de respuestas).
- AiService (generateSpec, generateArchitecture, etc., como librería).
- PrismaService (Project.legacyFlowState, mddContent, entregables).

La API pública (coordinador, revisor, controlador, knowledge-loader) está documentada con **JSDoc en español** (`@param`, `@returns`).

Ver plan histórico en `docs/archive/PLAN-FLUJO-LEGACY-V2.md`.

## Contrato con TheForge (SPEC-MCP-001)

- **Primario:** Se llama **`get_modification_plan(userDescription, projectId)`**. Respuesta: `{ filesToModify: string[], questionsToRefine: string[] }`. Garantías del MCP: `filesToModify` = solo rutas de nodos File del proyecto en FalkorDB (verificadas); `questionsToRefine` = solo preguntas de negocio/funcionalidad (no "¿hay otros componentes?").
- **Fallback:** Si el MCP no expone `get_modification_plan`, se usa `ask_codebase` con un prompt que pide el mismo JSON; se filtran preguntas tipo "otros componentes".
- **Sugerencias de respuestas:** Tras obtener las preguntas, se llama `ask_codebase` para rellenar sugerencias desde el codebase.
