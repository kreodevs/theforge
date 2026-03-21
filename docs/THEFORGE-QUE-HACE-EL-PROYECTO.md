# TheForge — Qué hace el proyecto (detalle técnico y flujos)

**Propósito:** Descripción operativa y técnica de TheForge para uso como fuente en NotebookLM y onboarding. Complementa la Documentación Estratégica (valor ejecutivo).

---

## 1. Resumen en una frase

TheForge es un monorepo (API NestJS + Web React) que orquesta una **entrevista proactiva con IA** hasta producir un **MDD (Master Design Document)** como Constitución del proyecto; valida completitud con un **semáforo** (ROJO/AMARILLO/VERDE), calcula **estimación en MXN** y genera entregables (Blueprint, API, Flujos, Infra). Soporta **proyectos nuevos** (desde cero) y **proyectos legacy** (cambios en código existente) integrando el grafo de código vía MCP Relic (AriadneSpecs).

---

## 2. Dos flujos principales

| Flujo | Entrada | Salida principal | Dónde vive |
|-------|---------|-------------------|------------|
| **Proyecto nuevo (SADD)** | Nombre del proyecto, chat con IA (entrevista) | MDD en sesión → Semáforo → Estimación → Entregables (Blueprint, SPEC, Casos de Uso, Historias, API, Flujos, Infra, Tasks) | Workshop: pestañas Entrevista, MDD, Semáforo, Entregables. Backend: `modules/ai`, `modules/engine`, `modules/projects`. |
| **Proyecto legacy** | Descripción del cambio + proyecto/repo indexado en Relic | Plan de modificación (archivos a modificar + preguntas de negocio) → Respuestas del usuario → MDD de cambio → misma cascada de entregables | Workshop: tab «Modificación» en proyectos LEGACY. Backend: `modules/legacy-flow` (Coordinador, Revisor), `modules/relic`. |

En ambos casos el **MDD es la Constitución**: todo se valida contra él (SDD). El semáforo y el estimador leen el contenido del MDD (y del proyecto) para calcular estado y coste.

---

## 3. Estructura del monorepo (Turborepo)

```
/
├── apps/
│   ├── api/          # NestJS: proyectos, sesiones, IA, engine, legacy-flow, Relic
│   └── web/          # React (Vite) + Tailwind: landing, Workshop (vista por proyecto)
├── packages/
│   ├── database/     # Prisma schema (Project, Stage, Session, Estimation→Stage, etc.) y client
│   ├── shared-types/ # DTOs e interfaces compartidas (Zod)
│   └── config/       # TypeScript, ESLint, Tailwind base
├── docs/             # Documentación (índice, planes, integración Relic)
├── blueprint.md      # Guía de implementación técnica (Constitución → plan)
├── mdd.md            # MDD del producto TheForge (7 secciones)
├── docker-compose.yml
└── turbo.json
```

---

## 4. Módulos principales del backend (apps/api)

| Módulo | Responsabilidad |
|--------|-----------------|
| **projects** | CRUD de proyectos; MDD + semáforo + estimación por **Stage** (etapa activa); entregables (Blueprint, SPEC, …) en `Project`; tipo NEW/LEGACY, `relicProjectId` para legacy. |
| **sessions** | Sesiones por proyecto; `chatLog` (historial de chat), `contextStep` (CONTEXT, DATA, LOGIC, SECURITY); persistencia de la entrevista. |
| **ai** | Orquestación de IA: adapters (OpenAI, Gemini) según `AI_PROVIDER`; generación de respuesta, checklist, Spec, MDD (multiagente: Clarifier, Architect, Security, Integration, Auditor), Blueprint, Casos de Uso, Historias, etc. Prompts en `modules/ai/prompts/`. |
| **engine** | Semáforo (validación del JSON/estructura del proyecto: entidades, business_core, edge_cases, field_types) y motor de estimación (cost-calculator: horas × tarifas MXN por rol). Lógica pura, sin IA. |
| **legacy-flow** | Coordinador (start → archivos + preguntas; answer; generate-mdd; generate-deliverables) y Revisor (revisa listas y documentos antes de persistir). Knowledge pack (NotebookLM/SDD/Agentic) en `knowledge/`. |
| **relic** | Cliente HTTP al MCP Relic (AriadneSpecs): `list_known_projects`, `get_modification_plan`, `ask_codebase`, `validate_before_edit`, `get_file_content`, `get_legacy_impact`, etc. Usado por legacy-flow para plan de modificación y contexto al generar MDD. |

---

## 5. Semáforo y estimación MXN

- **Semáforo:** Servicio que analiza el MDD de la **etapa activa** (`Stage.mddContent` / API aplanado como `project.mddContent`). ROJO = sin entidades o sin business_core; AMARILLO = entidades pero faltan edge_cases/field_types; VERDE = checklist completo y, si aplica, mapeo UX. Solo en VERDE se permite generar código/entregables completos.
- **Estimación:** Fórmula fija: `H_total = ((Entidades × 12) + (Pantallas × 16)) × 1.25`; coste = horas × tarifas por rol (Architect, Backend, Frontend, UX en MXN). Implementación en `engine/cost-calculator.service.ts`. No usa IA.

---

## 6. Integración Relic (proyectos legacy)

- **Relic** indexa repos/proyectos en un grafo (FalkorDB) y expone un MCP (AriadneSpecs). TheForge llama al MCP por **HTTP** (JSON-RPC, Bearer token) desde el backend.
- **Flujo:** Usuario crea proyecto legacy eligiendo un **proyecto** o **repositorio** indexado en Relic → se guarda `relicProjectId`. En «Modificación» describe el cambio → `get_modification_plan` devuelve `filesToModify` (path + repoId) y `questionsToRefine` → el usuario responde (con sugerencias desde `ask_codebase`) → al generar MDD se usa `validate_before_edit` (o `get_legacy_impact`), `get_file_content` y varias `ask_codebase` para contexto. Luego misma cascada de entregables que en proyecto nuevo.
- **Herramientas MCP usadas:** list_known_projects, get_modification_plan, ask_codebase, validate_before_edit, get_file_content, get_legacy_impact; disponibles get_contract_specs, get_component_graph. Ver `docs/integración relic/HERRAMIENTAS-MCP-RELIC.md`.

---

## 7. Entregables y cascada SDD

Orden de generación (cuando el proyecto está en VERDE o equivalente para legacy):

1. **MDD** (Constitución) — 7 secciones: Contexto, Arquitectura y Stack, Modelo de Datos, Contratos de API, Lógica y Edge Cases, Seguridad, Infraestructura.
2. **Spec** (Benchmark + clarifiedScope) — paso explícito antes de cerrar MDD.
3. **Blueprint** — plan técnico (estructura, módulos, persistencia).
4. **Casos de Uso** — derivados del MDD/Spec.
5. **Historias de usuario** — derivadas del MDD/Spec/Casos de Uso (sin inventar).
6. **Guía UX/UI**, **Contratos API**, **Flujos de lógica**, **Infraestructura** — documentos dedicados.
7. **Tasks** — tareas de implementación.

Cada entregable se valida (Revisor) y se persiste en el proyecto. La estructura canónica del MDD y el mapeo SDD están en `docs/ENTREGABLES-SDD-VALIDACION.md`.

---

## 8. Stack y despliegue

- **Backend:** NestJS, Prisma (PostgreSQL), adapters IA (OpenAI/Gemini). Opcional: Redis/BullMQ.
- **Frontend:** React 18, Vite, Tailwind. Proxy `/api` al backend en dev.
- **Despliegue:** Docker (Dokploy-ready): servicios api, web, db (Postgres), opcional redis. Healthchecks, variables de entorno documentadas. Un solo `docker-compose` en raíz.

---

## 9. Fuentes de verdad en el repo

| Documento | Uso |
|-----------|-----|
| **docs/THEFORGE-INDEX.md** | Índice de arquitectura: flujo, IA, semáforo, estimación, Docker. |
| **blueprint.md** | Guía de implementación técnica (Constitución → plan). |
| **mdd.md** | MDD del producto TheForge (7 secciones). |
| **docs/THEFORGE-DOCUMENTACION-ESTRATEGICA.md** | Valor ejecutivo (tesis, negocio, ROI). |
| **docs/ENTREGABLES-SDD-VALIDACION.md** | Estructura canónica del MDD, mapeo SDD, validación frente a Architecting Agentic Systems. |
| **docs/integración relic/** | Contrato con MCP Relic, herramientas, flujo legacy. |

---

*Este documento se mantiene alineado con el código y con los demás .md del repo. Actualizar cuando cambien flujos o módulos.*
