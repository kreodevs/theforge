# MDD: TheForge — Software Factory Orchestrator

**Versión:** 2.0 (2026-05-02)  
**Arquitectura:** Monorepo (Turborepo)  
**Estado del Semáforo:** 🟢 Operativo en producción  
**Stack:** NestJS + React (Vite) + PostgreSQL + FalkorDB + LangGraph + OpenRouter

---

## 1. Resumen Ejecutivo y Alcance

**TheForge** es una plataforma de **Software Factory Orchestrator** que transforma una idea de producto o cambio en sistemas existentes en un paquete completo de especificación técnica gobernada por un **MDD (Model-Driven Design Document)**.

### Pilares
- **Especificación como producto:** El MDD es la Constitución del proyecto (SDD) — todo se valida contra él.
- **Proyectos nuevos y legacy:** Desde cero (greenfield) o con código existente (Ariadne MCP).
- **Estimación predecible:** Costo en MXN (nómina interna y valor mercado) desde la especificación.
- **Calidad gobernada:** Semáforo ROJO/AMARILLO/VERDE que bloquea generación de entregables si el diseño es incompleto.
- **Mutietapa:** Un proyecto puede tener múltiples `Stage` (versiones del MDD), cada una con su propio semáforo, estimación, BRD/To-Be/As-Is y documentación.

### Alcance
- **In-scope:** Entrevista proactiva con IA → MDD → Semáforo → Estimación → Entregables (Spec, Blueprint, API, Flujos, Infra, Tasks). Soporte para cambios en sistemas legacy con integración Ariadne MCP. Flujo BRD → To-Be → MDD con gates opcionales.
- **Out-of-scope:** Generación de código ejecutable (solo especificaciones y documentos). Despliegue multi-tenant SaaS (actualmente single-tenant con JWT).

---

## 2. Arquitectura de Software

### 2.1 Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Backend | NestJS | ^10.4.x |
| Frontend | React + Vite + Tailwind | ^18.3 / ^6 / ^3.4 |
| Base de Datos | PostgreSQL 15 + Prisma ORM | ^5.22 |
| Grafo Documental | FalkorDB | ^6.6 |
| Colas | BullMQ + Redis | ^5.71 |
| IA | OpenRouter (adapter) + LangGraph | ^0.2.x |
| MCP Propio | `@theforge/mcp-server` (stdio/HTTP) | - |
| MCP Externo | AriadneSpecs (HTTP JSON-RPC) | - |
| Infraestructura | Docker / Dokploy | - |

### 2.2 Estructura del Monorepo

```
/theforge/
├── apps/
│   ├── api/          # NestJS — orquestador, IA, proyectos, legacy
│   └── web/          # React — Workshop, Login, Lista proyectos
├── packages/
│   ├── database/     # Prisma schema + client
│   ├── shared-types/ # DTOs e interfaces (Zod)
│   ├── business-rules/ # Reglas puras (estimación, constantes)
│   ├── config/       # TS, ESLint, Tailwind base
│   └── mcp-server/   # Servidor MCP propio
├── docs/             # Documentación + corpus NotebookLM
├── docker-compose.yml
└── turbo.json
```

### 2.3 Módulos principales (apps/api)

| Módulo | Responsabilidad |
|---|---|
| **auth** | JWT + OTP (email), guard global |
| **projects** | CRUD, etapas (`Stage`), entregables, gate BRD/To-Be |
| **sessions** | Sesiones por proyecto, `chatLog`, persistencia |
| **ai** | LLM provider (OpenRouter adapter), generación de respuestas |
| **engine** | Semáforo + estimación (lógica pura, sin IA) |
| **ai-analysis** | LangGraph multiagente MDD, DBGA (Fase 0) |
| **ai-orchestrator** | Orquestador del chat Workshop → AgentSupervisor |
| **agent-supervisor** | Supervisor agéntico, ingest a Falkor, herramientas SDD |
| **theforge** | Cliente HTTP al MCP AriadneSpecs |
| **legacy-flow** | Flujo legacy: start → answer → MDD de cambio → entregables |
| **scraper** | Scraping de URLs (Cheerio) para Fase 0 |
| **graph-memory** | FalkorDB SDD: entidades, endpoints, salud del grafo |

### 2.4 Flujo de datos principal

```
[Workshop UI] → HTTP → [AiOrchestrator] → [AgentSupervisor] → [LangGraph]
                                                                    │
                             ┌──────────────────────────────────────┤
                             ▼                                      ▼
                    [AiService/OpenRouter]                    [FalkorDB SDD]
                             │                                      │
                             ▼                                      ▼
                    [LlM vía OpenRouter]                    [GraphMemoryService]
```

---

## 3. Modelo de Datos

### 3.1 Modelo relacional (Prisma)

**User** — usuarios del sistema (auth JWT/OTP)

**Project** — proyectos de software (NEW o LEGACY):
- `id`, `name`, `projectType`, `userId`
- `theforgeProjectId` — ID en Ariadne MCP (legacy)
- `requireBrdTobeGate` — si exige BRD/To-Be antes de MDD técnico
- Etapa activa (primera con `workflowStatus = ACTIVE`)
- Entregables globales: `blueprintContent`, `specContent`, `apiContractsContent`, `infraContent`, `uxUiGuideContent`, `tasksContent`, `useCasesContent`, `userStoriesContent`, `logicFlowsContent`, `phase0SummaryContent`, `dbgaContent`

**Stage** — ciclo SDD por versión del proyecto:
- `mddContent` — Constitución MDD (7 secciones)
- `brdContent`, `toBeManualContent`, `asIsManualContent` — precursores
- `status` (ROJO/AMARILLO/VERDE), `precisionScore`
- `workflowStatus` (DRAFT/ACTIVE/COMPLETED)
- `estimation` (1:1) — horas, MXN, teamStructure

**Session** — sesiones de chat por proyecto: `chatLog`, `contextStep`

**Estimation** — métricas de costo por etapa:
- `totalHours`, `totalMxn` (nómina), `totalMxnMarket` (mercado)
- `teamStructure` (horas por rol), `teamRoles` (labels)

**ArchitecturalPreference** — preferencias aprendidas del usuario

### 3.2 Modelo en grafo (FalkorDB)

Nodos: `Project`, `Stage`, `LegacyStage`, `MDD_Section`, `DB_Entity`, `API_Endpoint`
Relaciones: `HAS_STAGE`, `IMPLEMENTS`, `OWNS_ENTITY`, `CONSUMES`, `DERIVED_FROM` (etapas legacy)

---

## 4. Integración de IA

### 4.1 Proveedor: OpenRouter (Strategy Pattern)

- **Interfaz:** `LLMProvider` (abstract)
- **Adapter:** `OpenRouterAdapter` (SDK `openai`)
- **Factory:** `createLLMProvider()` → Nest DI
- **Embeddings:** `OPENROUTER_EMBEDDING_MODEL` o desactivado con `LLM_EMBEDDINGS_PROVIDER=none`

### 4.2 Pipeline MDD (Multiagente LangGraph)

1. **Manager** recibe mensaje del usuario → decide flujo
2. **Clarifier** → Sección 1 (Contexto y Alcance)
3. **Software Architect** → Secciones 2, 3, 4, 5
4. **Architect Critic** → verifica §3/§4, loop si hay gaps
5. **Security** → Sección 6
6. **Integration** → Sección 7
7. **Diagram Injector** → Mermaid ER desde SQL
8. **Auditor** → score, feedback, decisión (clarifier | done)

### 4.3 Fase 0 (DBGA)

1. **Scout** — investigación de mercado (Tavily + web)
2. **Tech Auditor** — stack de competidores
3. **Critic** — validación y re-investigación
4. **Synthesis** — documento DBGA final

### 4.4 MCP externo (AriadneSpecs)

Para proyectos legacy: `TheForgeService` invoca herramientas MCP vía HTTP JSON-RPC:
- `list_known_projects`, `get_modification_plan`, `ask_codebase`
- `get_file_content`, `get_legacy_impact`, `semantic_search`
- `validate_before_edit`

---

## 5. Lógica de Negocio

### 5.1 Semáforo de Calidad

| Estado | Rango | Condición |
|---|---|---|
| ROJO | <85% | Sin entidades, sin business_core, o gaps críticos |
| AMARILLO | 85-94% | Faltan edge_cases, field_types, o puertas de constitución |
| VERDE | ≥95% | Checklist completo O grafo SDD coherente que alivia gaps |

### 5.2 BRD/To-Be Gate

Proyectos con `requireBrdTobeGate=true`:
- Exigen BRD y To-Be aprobados (con timestamps en Stage)
- Sin aprobación, el stream MDD emite evento `blocked`
- Legado: `LEGACY` default `false` (MDD inicial sin obligación)

### 5.3 Etapas como cambios legacy

Cada etapa de cambio en un proyecto legacy es un `Stage` independiente:
- `Stage 1`: MDD inicial, BRD "sistema actual", To-Be "sistema actual"
- `Stage 2+`: DERIVED_FROM etapa anterior; prompt incremental
- FalkorDB sincroniza relaciones entre etapas

### 5.4 Flujo Chat Legacy

El chat en modo legacy:
- Inyecta instrucción: "Si el usuario menciona un cambio o hay ambigüedad, preguntar si es consulta o cambio"
- Desambiguación antes de activar flujo de cambio

---

## 6. Seguridad

### 6.1 Autenticación
- **OTP por email** (`EMAIL_OTP` + SMTP config) — solo correos pre-registrados
- **JWT** (`JWT_SECRET`, `JWT_EXPIRES_IN` default 7d)
- **Guard global** `JwtAuthGuard` — toda la API protegida

### 6.2 MCP
- `MCP_AUTH_TOKEN` (Bearer) o `MCP_X_M2M_TOKEN` para Ariadne MCP
- `MCP_M2M_SECRET` para auth del MCP server propio (login JWT compartido)

### 6.3 Otras medidas
- CORS restringido por `CORS_ORIGINS` en producción
- Validación Zod en todos los controllers
- Scraper con `ip-range-check` (SSRF guard), timeout y límite de body
- Sin SQL crudo (Prisma parametrizado)

---

## 7. Infraestructura

### 7.1 Despliegue (Dokploy / Docker)

6 servicios en `docker-compose.yml`:

| Servicio | Puerto interno | Expuesto | Persistencia |
|---|---|---|---|
| `theforge-db` (Postgres) | 5432 | No | Volumen `theforge_db_data` |
| `theforge-redis-queue` | 6379 | No | Volumen `theforge_redis_queue_data` |
| `theforge-falkor-sdd` | 6379 | 6380 | Volumen `theforge_falkor_data` |
| `theforge-api` | 3000 | Sí (vía Traefik) | - |
| `theforge-web` (Nginx) | 80 | Sí (público) | - |
| `theforge-mcp` | 3100 | No | - |

### 7.2 Routing (Traefik en Dokploy)

- `/` → `theforge-web:80`
- `/api` (strip path) → `theforge-api:3000`

### 7.3 Variables de entorno clave

Ver `README.md` y `.env.example` para la lista completa (>50 variables categorizadas: core, IA, MCP, caché, legacy, entregables, frontend, operacionales).

### 7.4 Consideraciones de red

- Comunicación interna por nombres Docker (ej. `theforge-api:3000`)
- `localhost` en Docker = propio contenedor — NO usar para cross-service
- Red única `theforge-app-network` para evitar agotar pools de Docker

---

*Documento generado desde el código del monorepo `theforge`. Última revisión: 2026-05-02.*
