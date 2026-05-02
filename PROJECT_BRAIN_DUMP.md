# The Forge — Knowledge Base (NotebookLM / PROJECT_BRAIN_DUMP)

> **Propósito:** Documento maestro para cuadernos de estudio (p. ej. NotebookLM). Describe el monorepo **theforge** tal como está en el código a mayo 2026.
> **No confundir:** Este repo es **The Forge** (Software Factory: entrevista → MDD → semáforo → estimación). No es el producto "Google Antigravity"; la IA agéntica usa **LangChain / LangGraph** y orquestación propia (`AgentSupervisor`), con el LLM **vía OpenRouter** (API compatible OpenAI; adapter `OpenRouterAdapter`).

---

## 1. Executive Summary

**The Forge** es una aplicación **Specification-Driven Development (SDD)** que guía un proyecto desde una **entrevista proactiva con IA** hasta un **Master Design Document (MDD)** de 7 secciones canónicas, un **semáforo** de calidad (ROJO / AMARILLO / VERDE), **estimación de coste en MXN** (nómina interna + valor mercado) y generación de **entregables** (Spec, Blueprint, contratos API, flujos, infra, tasks, etc.).

- **Frontend:** React 18 + Vite 6 + Tailwind 3, estado con Zustand.
- **Backend:** NestJS 10, Prisma 5 + PostgreSQL, grafo documental en **FalkorDB** (Cypher), colas **BullMQ** vía Redis, integración **HTTP JSON-RPC** con MCP externo **AriadneSpecs**.
- **IA:** Patrón **strategy** (`LLMProvider` → `OpenRouterAdapter`); **LangGraph** para grafos de agentes multi-etapa; **AgentSupervisor** como capa de orquestación.
- **Multi-etapa:** Un proyecto tiene múltiples `Stage` (etapas), cada una con su propio MDD, semáforo, BRD/To-Be/As-Is y estimación. Las etapas legacy se relacionan en FalkorDB (`DERIVED_FROM`).
- **MCP propio:** `@theforge/mcp-server` expone la API Nest como herramientas MCP (stdio/HTTP).

**Fuentes canónicas en repo:** `docs/notebooklm/THEFORGE-INDEX.md`, `docs/notebooklm/STAGE-SDD.md`, `blueprint.md`, `mdd.md`.

---

## 2. Deep Dive Arquitectónico

### 2.1 Patrón de diseño

| Capa | Patrón / estilo |
|---|---|
| API | **Modular monolith (NestJS)**: módulos por dominio, DI de Nest, guards globales (`JwtAuthGuard`) |
| IA | **Ports & Adapters**: interfaz `LLMProvider`; implementación `OpenRouterAdapter` |
| Datos relacionales | **Repository vía PrismaService**; modelos User, Project, Stage, Session, Estimation |
| Grafo SDD | **FalkorDB** — nodos por stageId: Project, Stage, DB_Entity, API_Endpoint |
| Legacy / código | **TheForgeService** cliente HTTP al MCP Ariadne; **LegacyCoordinatorService** |
| MCP propio | **`@theforge/mcp-server`** — herramientas sobre la API Nest (proyectos, entregables, orquestador) |

### 2.2 Estructura de carpetas

```
theforge/
├── apps/
│   ├── api/                 # NestJS — auth, ai, engine, projects, sessions,
│   │                         # ai-orchestrator, agent-supervisor, ai-analysis,
│   │                         # theforge, legacy-flow, scraper, graph-memory
│   └── web/                 # React + Vite — Workshop, Login, Lista proyectos
├── packages/
│   ├── database/            # schema.prisma, migraciones
│   ├── shared-types/        # Zod/DTOs compartidos
│   ├── business-rules/      # Estimación MXN, constantes (fuente única)
│   ├── config/              # tsconfig, eslint, tailwind base
│   └── mcp-server/          # Servidor MCP propio (stdio/HTTP)
├── docs/
│   ├── JSDOC.md             # Convenciones de documentación
│   ├── notebooklm/          # Corpus: THEFORGE-INDEX, SDD, MCP, planes
│   └── archive/             # Histórico y roadmaps
├── docker-compose.yml       # 6 servicios: db, redis, falkor, api, web, mcp
├── blueprint.md             # Guía de implementación técnica
├── mdd.md                   # MDD del producto TheForge (7 secciones)
└── turbo.json
```

### 2.3 Flujo de datos principal

```
Web [WorkshopView + Zustand] → apiFetch (JWT)
                                     ↓
                          AiOrchestratorService
                                     ↓
                          AgentSupervisorService
                                    /  \
                                   /    \
                         LangGraph     GraphMemoryService (FalkorDB)
                         (MDD agents)        /        \
                            |              /          \
                       OpenRouter     FalkorDB     PostgreSQL
                       (LLM)          (grafo SDD)  (Prisma)
```

---

## 3. Stack Tecnológico

| Área | Paquete | Versión |
|---|---|---|
| Monorepo | npm workspaces / turbo | ^2.3 |
| Runtime Node | engines | >=20 |
| API framework | @nestjs/* | ^10.4.x |
| ORM | prisma / @prisma/client | ^5.22 |
| Colas | bullmq | ^5.71 |
| Grafo SDD | falkordb | ^6.6 |
| IA (OpenRouter) | openai SDK | ^4.73 |
| IA (orquestación) | @langchain/langgraph | ^0.2.x |
| Web | react / react-dom | ^18.3 |
| Web build | vite | ^6 |
| Web estado | zustand | ^5 |
| Markdown UI | react-markdown + mermaid | ^10.x / ^11.x |
| Estilos | tailwindcss | ^3.4 |

---

## 4. Inventario de Funcionalidades

| Funcionalidad | Archivos clave |
|---|---|
| Auth OTP + JWT | `modules/auth/` (guard global, JWT, OTP email) |
| Proyectos + Etapas | `modules/projects/` (CRUD, Stage, entregables, gates) |
| Sesiones / chat | `modules/sessions/` (chatLog, contextStep) |
| LLM unificado | `modules/ai/` (LLMProvider, OpenRouterAdapter) |
| Semáforo | `modules/engine/` + `@theforge/business-rules` |
| Estimación MXN | `modules/engine/` + `business-rules` (fuente única) |
| Pipeline MDD multiagente | `modules/ai-analysis/` (LangGraph, 7 agentes) |
| DBGA / Fase 0 | `modules/ai-analysis/` (Scout, Tech Auditor, Synthesis) |
| Orquestador chat | `modules/ai-orchestrator/` |
| Supervisor agéntico | `modules/agent-supervisor/` (herramientas, Falkor) |
| Cliente MCP Ariadne | `modules/theforge/` (HTTP JSON-RPC) |
| Flujo legacy | `modules/legacy-flow/` (coordinator, staged discovery) |
| Grafo Falkor SDD | `modules/graph-memory/` (Cypher queries) |
| Scraper URLs | `modules/scraper/` (Cheerio, ip-range-check) |
| MCP server propio | `packages/mcp-server/` (40+ herramientas) |
| Workshop UI | `apps/web/src/views/WorkshopView.tsx` |
| Lista proyectos | `apps/web/src/App.tsx` |

### 4.1 Flujo Greenfield (proyectos nuevos)
Paso 0 (DBGA) → BRD (opcional gate) → To-Be (opcional) → MDD §1–7 → Semáforo → Entregables

### 4.2 Flujo Legacy (cambios en código existente)
Start (modification plan) → Answer (preguntas) → As-Is → BRD/To-Be (opcional) → MDD de cambio → Entregables. Cada etapa es un `Stage` independiente con trazabilidad FalkorDB.

---

## 5. Lógica de Negocio Crítica

1. **MDD de 7 secciones:** Orden canónico: Contexto, Arquitectura y Stack, Modelo de Datos, Contratos API, Lógica y Edge Cases, Seguridad, Infraestructura.
2. **Semáforo:** ROJO <85%, AMARILLO 85-94%, VERDE ≥95% (con alivio de grafo SDD).
3. **Estimación:** Fórmula en `@theforge/business-rules`. Nómina interna: $185/hr. Mercado: $1,050/hr.
4. **Etapas como cambios:** Cada cambio legacy = nuevo Stage con `DERIVED_FROM` a etapa anterior en FalkorDB.
5. **BRD/To-Be Gate:** Opcional por proyecto. Exige BRD y To-Be aprobados antes de generar MDD técnico.
6. **Chat legacy con desambiguación:** Si el usuario menciona un cambio o hay ambigüedad, preguntar si es consulta o cambio.
7. **LLM aislado:** Ningún servicio de negocio importa SDK `openai` directamente.
8. **Conformance:** Blueprint/API/Infra vs MDD — gates que bloquean generación si hay gaps.
9. **Preferencias arquitectónicas aprendidas:** `ArchitecturalPreference` desde MDDs anteriores.

---

## 6. Puntos de Extensión

- **Duplicación documentación vs código:** Algunos archivos `docs/` pueden quedar desactualizados. Este documento y `THEFORGE-INDEX.md` son la fuente canónica.
- **Agentic AI:** LangGraph + checkpoints en Postgres. Complejidad alta — candidato a diagramas de secuencia.
- **MCP:** `@theforge/mcp-server` evoluciona con cada nuevo endpoint de producto.
- **Multi-tenant:** Modelo actual por `userId` en `Project`. Sin aislamiento multi-org pensado aún.

---

## 7. Preguntas Abiertas

1. ¿BullMQ + Redis obligatorio en todos los despliegues o mantener modo síncrono?
2. ¿Evolucionar el modelo de costos para incluir costo de tokens IA en la estimación?
3. ¿Multi-tenant con aislamiento real por organización?

---

## 8. Referencias rápidas de archivos

| Tema | Ruta |
|---|---|
| Entrada Nest | `apps/api/src/main.ts`, `app.module.ts` |
| Chat HTTP | `apps/api/src/modules/ai-orchestrator/` |
| Supervisor | `apps/api/src/modules/agent-supervisor/` |
| Prisma schema | `packages/database/schema.prisma` |
| Cliente MCP | `apps/api/src/modules/theforge/theforge.service.ts` |
| Legacy | `apps/api/src/modules/legacy-flow/legacy-coordinator.service.ts` |
| Grafo SDD | `apps/api/src/modules/graph-memory/graph-memory.service.ts` |
| Workshop | `apps/web/src/views/WorkshopView.tsx` |
| Store | `apps/web/src/store/workshopStore.ts` |
| Índice arquitectura | `docs/notebooklm/THEFORGE-INDEX.md` |
| Docker | `docker-compose.yml`, `.env.example` |
| MCP server propio | `packages/mcp-server/src/index.ts` |

---

*Actualizado al estado del monorepo a mayo 2026.*
