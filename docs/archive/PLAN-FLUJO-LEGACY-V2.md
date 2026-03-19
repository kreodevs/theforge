# Plan: Flujo Legacy separado y base de conocimiento (NotebookLM)

**Objetivo:** Mantener los agentes de **proyectos nuevos** intactos y exclusivos; crear un **flujo legacy separado** con coordinador, revisor, Relic MCP y generación de MDD → SPEC → Arquitectura → Casos de uso → Historias con DoD → Guía UX/UI → API → Flujos → Tasks, usando como base de conocimiento tres cuadernos de NotebookLM y el grafo Relic.

**Cuadernos NotebookLM como base de conocimiento:**
- Arquitectura de Prompts y Patrones
- Specification-Driven Development and the Evolution of AI Engineering
- Architecting Agentic Systems: Frameworks, Patterns, and Advanced Workflows

---

## 1. Principios

| Principio | Detalle |
|-----------|---------|
| **Proyectos nuevos** | Los agentes actuales (Paso 0, DBGA, Manager MDD, Clarifier, Auditor, etc.) **no se tocan**. Cualquier cambio que los haya hecho servir también para legacy se revierte; quedan **exclusivos** para producto nuevo. |
| **Legacy = flujo distinto** | Entrada distinta (descripción de modificación), **sin Paso 0**, uso de Relic MCP para archivos/impacto y preguntas, luego MDD y cascada de entregables. |
| **Agentes legacy** | Al menos **Coordinador** (orquesta pasos, Relic, preguntas) y **Revisor** (revisa salidas antes de darlas al usuario). Conocimiento: Relic + contenido derivado de los 3 cuadernos. |

---

## 2. Flujo legacy (resumen)

```
[Usuario describe modificación]
        ↓
Coordinador + Relic MCP → lista de archivos a modificar + preguntas para modelar el cambio
        ↓
[Usuario responde / refina]
        ↓
Coordinador + Revisor → generación del **MDD** (documento de cambio)
        ↓
Desde MDD + contexto Relic → generación en cascada:
  SPEC → Arquitectura → Casos de uso → Historias de usuario (con DoD) → Guía UX/UI → API → Flujos → Tasks
```
Cada etapa puede tener un agente dedicado o reutilizar generadores existentes **solo como librería**, invocados por el coordinador legacy con contexto Relic y conocimiento de los cuadernos; el **flujo** (qué se llama y en qué orden) es exclusivo del pipeline legacy.

---

## 3. Base de conocimiento (cuadernos NotebookLM)

Los tres cuadernos no están en el backend. Opciones:

- **A) Export a markdown:** Exportar (o copiar) el contenido de cada cuaderno a archivos markdown en el repo (p. ej. `apps/api/src/modules/legacy-flow/knowledge/`) y cargarlos en los prompts del flujo legacy.
- **B) Paquete de contexto curado:** Crear un único “knowledge pack” (markdown o JSON) con principios, patrones y fragmentos extraídos de los cuadernos, y usarlo en system prompts del coordinador y revisor.
- **C) API/NotebookLM MCP desde backend:** Si en el futuro el backend pudiera llamar a NotebookLM (o a un servicio que exponga ese contenido), se podría inyectar dinámicamente. No asumir por ahora.

**Recomendación:** Empezar con **A** o **B** (contenido estático en repo) para no depender de Cursor/NotebookLM en runtime. Si los cuadernos cambian, se actualiza el export o el paquete.

---

## 4. Cambios por área

### 4.1 Proyectos nuevos (no tocar lógica; aislar invocación)

- **ai-analysis:** Sin cambios en Manager, Clarifier, Auditor, phase0, DBGA. No añadir ramas por `projectType`.
- **projects.service:** `phase0DeepResearch`, `generateSpec`, `generateArchitecture`, etc. se mantienen como están. La **web** solo debe invocarlos cuando el proyecto sea **NEW** (o sin tipo, por compatibilidad).
- **Web (Workshop):** Si `projectType === 'LEGACY'`:
  - No mostrar / no invocar: Paso 0, “Generar Benchmark”, “Generar MDD con agentes” (stream del Manager actual), “Generar Deep Research”.
  - Mostrar en su lugar la **vista del flujo legacy**: descripción de modificación → llamada al nuevo pipeline legacy (coordinador + Relic → archivos + preguntas → … → MDD → cascada de entregables).

### 4.2 Flujo legacy (nuevo módulo / servicios)

- **Módulo nuevo:** p. ej. `legacy-flow` o `legacy-orchestrator` en `apps/api`, con:
  - **LegacyCoordinator:** Orquesta el flujo; consulta Relic MCP (`get_legacy_impact`, `validate_before_edit`, `get_contract_specs`, etc.); presenta al usuario la lista de archivos a modificar y preguntas; dispara generación de MDD y luego la cascada SPEC → … → Tasks; usa conocimiento de los 3 cuadernos (vía A o B).
  - **LegacyReviewer:** Revisa salidas (lista de archivos, MDD, SPEC, etc.) antes de devolverlas al usuario; mismo conocimiento base.
- **Relic MCP:** Ampliar uso en este flujo: además de `list_known_projects` y `ask_codebase`, usar `validate_before_edit`, `get_legacy_impact`, `get_contract_specs`, `get_component_graph` según necesite el coordinador.
- **Endpoints:** Por ejemplo:
  - `POST /legacy-flow/start` (o `POST /projects/:id/legacy/start`): body `{ description: string }` → coordinador consulta Relic, devuelve `{ filesToModify: [...], questions: [...] }`.
  - `POST /legacy-flow/answer` (o `.../legacy/answer`): body `{ answers: {...} }` → siguiente paso (refinar o generar MDD).
  - `POST /legacy-flow/generate-mdd`: genera MDD de cambio (coordinador + revisor).
  - `POST /legacy-flow/generate-deliverables`: desde MDD + Relic genera SPEC, Arquitectura, Casos de uso, Historias (DoD), Guía UX/UI, API, Flujos, Tasks (cada uno puede ser un sub-llamada con contexto Relic y knowledge pack).

### 4.3 Chat actual para legacy (ai-orchestrator)

- Hoy: en proyecto LEGACY el chat usa `LEGACY_DOCUMENTATION_PROMPT` + `ask_codebase`. Opciones:
  - **Opción 1:** Quitar esa lógica del chat genérico; el único flujo legacy sea el nuevo pipeline (coordinador + revisor + endpoints anteriores). El chat en Workshop legacy solo sería “conversación de apoyo” o se oculta.
  - **Opción 2:** Dejar el chat legacy como “paso 1” conversacional: el usuario escribe la modificación y el backend (vía coordinador) usa Relic y devuelve archivos + preguntas en la respuesta del chat; el resto del flujo (MDD, entregables) sigue por endpoints dedicados.

Recomendación: **Opción 2** para no romper la UX actual; el primer mensaje legacy puede disparar la consulta Relic y mostrar archivos + preguntas en el chat, y a partir de ahí el flujo continúa con botones/endpoints (generar MDD, generar entregables).

### 4.4 Revisar y revertir “compartido”

- Revisar **ai-orchestrator** y **ai-analysis** por si en algún momento se añadieron ramas por `projectType` o “legacy” en los agentes de producto nuevo. Si se encuentra, **revertir** y dejar esos agentes solo para proyecto nuevo.
- En **web:** ya se distingue por `projectType`; falta que las acciones “Paso 0”, “Generar Benchmark”, “Generar MDD con agentes”, “Generar Deep Research” solo estén disponibles (o se llamen) cuando el proyecto **no** sea LEGACY, y que en LEGACY se use solo la nueva vista y endpoints del flujo legacy.

---

## 5. Fases sugeridas

| Fase | Descripción |
|------|-------------|
| **1** | Aislar proyectos nuevos: en web, ocultar/deshabilitar Paso 0, Benchmark, “Generar MDD con agentes”, Deep Research cuando `projectType === 'LEGACY'`. Revisar y revertir cualquier lógica legacy dentro de ai-analysis/projects que afecte a agentes de producto nuevo. |
| **2** | Base de conocimiento: export o paquete de los 3 cuadernos (markdown en repo o knowledge pack) y carga en prompts del flujo legacy. |
| **3** | Módulo legacy-flow: LegacyCoordinator + LegacyReviewer, integración con RelicService (ampliar con validate_before_edit, get_legacy_impact, get_contract_specs, etc.). Endpoints: start (descripción → archivos + preguntas), answer, generate-mdd, generate-deliverables. |
| **4** | Web: vista/panel legacy en Workshop (solo si `projectType === 'LEGACY'`): formulario o chat para “describir modificación” → llamada a legacy/start → mostrar archivos y preguntas → respuestas → generar MDD → generar entregables. |
| **5** | Cascada de entregables legacy: desde MDD + Relic + knowledge pack, orquestar generación de SPEC, Arquitectura, Casos de uso, Historias (DoD), Guía UX/UI, API, Flujos, Tasks (reutilizando lógica existente donde aplique, pero invocada solo desde el coordinador legacy con contexto correcto). |

---

## 6. Criterios de aceptación

- [ ] Proyectos nuevos: mismo flujo que hoy (Paso 0 opcional, Benchmark, Manager MDD, Deep Research, SPEC, etc.); ningún agente de producto nuevo contiene ramas ni lógica para legacy.
- [ ] Proyecto legacy: sin Paso 0; usuario describe modificación; coordinador usa Relic y devuelve archivos a modificar + preguntas; usuario puede responder; se genera MDD; desde MDD se generan SPEC, Arquitectura, Casos de uso, Historias (DoD), Guía UX/UI, API, Flujos, Tasks, usando Relic y conocimiento de los 3 cuadernos.
- [ ] Revisor revisa salidas relevantes del flujo legacy antes de presentarlas al usuario.
- [ ] Base de conocimiento: los 3 cuadernos de NotebookLM incorporados vía export/pack estático en el flujo legacy.

Cuando este plan esté aprobado, se puede bajar a tareas por fase (y opcionalmente a issues) e implementar sin tocar el flujo de proyectos nuevos.
