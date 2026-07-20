# Implementation Blueprint: "TheForge"

**Versión:** 2.0 (2026-05-02)  
**Objetivo:** Documento de implementación técnica del monorepo TheForge, alineado con la arquitectura actual (NestJS, Prisma, FalkorDB, LangGraph, OpenRouter).  
**Fuente:** El MDD actúa como **Constitución del proyecto** (SDD); este Blueprint se genera desde el MDD y no debe contradecirlo.

---

## 1. Estructura del Monorepo (Turborepo)

```
/theforge (Root)
├── apps/
│   ├── api/                # NestJS Backend (orquestador, IA, proyectos, legacy)
│   └── web/                # React (Vite) + Tailwind Frontend (Workshop, Login)
├── packages/
│   ├── database/           # Prisma Schema & Client
│   ├── shared-types/       # Interfaces y DTOs (Zod)
│   ├── business-rules/     # Reglas puras compartidas (estimación MXN, constantes)
│   ├── config/             # Configuración TS, ESLint, Tailwind
│   └── mcp-server/         # Servidor MCP propio (@theforge/mcp-server)
├── docs/
│   ├── JSDOC.md            # Convenciones de documentación en código
│   ├── notebooklm/         # Corpus para NotebookLM (índice, SDD, MCP, planes)
│   └── archive/            # Histórico y roadmaps no prioritarios
├── docker-compose.yml      # Orquestación Dokploy (6 servicios)
├── turbo.json              # Configuración de Pipeline
└── .env.example            # Todas las variables documentadas
```

---

## 2. Definición de la Base de Datos (`packages/database/schema.prisma`)

El esquema soporta **proyectos multi-etapa**, **BRD/To-Be/As-Is por etapa**, **memoria episódica** y **motor de costos**. Modelos principales:

### Principales modelos

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  projects  Project[]
  createdAt DateTime @default(now())
}

model Project {
  id                   String   @id @default(uuid())
  name                 String
  projectType          ProjectType @default(NEW)
  theforgeProjectId    String?     // UUID del proyecto en Ariadne/MCP
  hasUxTeam            Boolean     @default(false)
  userId               String
  user                 User       @relation(fields: [userId], references: [id])
  
  // Entregables a nivel proyecto
  dbgaContent          String?    @db.Text
  blueprintContent     String?    @db.Text
  specContent          String?    @db.Text
  apiContractsContent  String?    @db.Text
  logicFlowsContent    String?    @db.Text
  infraContent         String?    @db.Text
  uxUiGuideContent     String?    @db.Text
  useCasesContent      String?    @db.Text
  userStoriesContent   String?    @db.Text
  tasksContent         String?    @db.Text
  phase0SummaryContent String?    @db.Text
  
  // Flags de control
  // Flag histórico; gate BRD/To-Be retirado jul 2026 — ya no bloquea pipeline
  requireBrdTobeGate   Boolean    @default(false)
  complexityPending    Boolean?   @default(false)
  complexityLevel      ComplexityLevel?
  
  // Relaciones
  stages               Stage[]
  sessions             Session[]
  createdAt            DateTime   @default(now())
}

model Stage {
  id                  String   @id @default(uuid())
  projectId           String
  project             Project  @relation(fields: [projectId], references: [id])
  ordinal             Int      @default(1)
  workflowStatus      StageStatus @default(DRAFT)
  isLegacy            Boolean  @default(false)
  theforgeProjectId   String?  // ID alternativo por etapa
  
  // Ciclo SDD por etapa
  mddContent          String?  @db.Text       // Constitución MDD
  brdContent          String?  @db.Text       // Business Requirements Document
  toBeManualContent   String?  @db.Text       // Manual To-Be
  asIsManualContent   String?  @db.Text       // Mapa As-Is (legacy)
  brdApprovedAt       DateTime?
  toBeApprovedAt      DateTime?
  
  // Semáforo y precisión
  status              Status   @default(ROJO) // ROJO | AMARILLO | VERDE
  precisionScore      Int      @default(0)
  
  // Estado del flujo legacy (solo MCP/descubrimiento)
  legacyFlowState     Json?    // codebaseDoc, respuestas, debug
  
  estimation          Estimation?
  createdAt           DateTime @default(now())
}

model Estimation {
  id            String @id @default(uuid())
  stageId       String @unique
  stage         Stage  @relation(fields: [stageId], references: [id])
  totalHours    Float
  totalMxn      Float      // Nómina interna (tarifa INTERNAL_HOUR_RATE)
  totalMxnMarket Float?    // Valor mercado (tarifa MARKET_HOUR_RATE)
  teamStructure Json       // Record<string, number> — horas por rol
  teamRoles     Json?      // Record<string, string> — rol labels
  readinessHints String?   // Pistas IA
}

enum Status { ROJO, AMARILLO, VERDE }
enum ProjectType { NEW, LEGACY }
enum StageStatus { DRAFT, ACTIVE, COMPLETED }
enum ComplexityLevel { LOW, MEDIUM, HIGH }
```

### Relaciones clave adicionales
- `Session` → cuelga de `Project`, contiene `chatLog` (historial) y `contextStep`
- `EpisodicMemory` — memoria episódica del orquestador por proyecto
- `ArchitecturalPreference` — preferencias aprendidas del usuario

---

## 3. Lógica de IA (Agnóstica)

### 3.1 Adapter Pattern

Un solo adapter: tráfico LLM vía **OpenRouter** (API compatible OpenAI).

- **Interfaz:** `LLMProvider` en `modules/ai/interfaces/`
- **Implementación:** `OpenRouterAdapter` (SDK `openai` + `baseURL` OpenRouter)
- **Config:** `resolvePrimaryChatRuntime()` en `llm-config.ts` (clave, URL, modelos)
- **Factory:** `createLLMProvider()` → `OpenRouterAdapter`, inyectada en Nest DI

### 3.2 Variables de entorno

- `OPENROUTER_API_KEY` (o alias `AI_API_KEY` / `OPENAI_API_KEY`)
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`)
- `OPENROUTER_CHAT_MODEL` (default configurable)
- `OPENROUTER_EMBEDDING_MODEL` (default `openai/text-embedding-3-small`)
- `TAVILY_API_KEY` — búsqueda web (Scout)

### 3.3 Orquestación multiagente (LangGraph) — pipeline MDD lean

| Componente | Rol |
|---|---|
| **Manager** | Orquesta flujo delgado: delega a generadores según intención; re-enruta tras Quality Gate (máx. 2 rondas) |
| **Clarifier** | Sección 1 (Contexto y Alcance) + preguntas de refinamiento |
| **Software Architect** | Secciones 2–5 (Stack, Modelo, API, Lógica) |
| **Security Architect** | Sección 6 (Seguridad) — en paralelo con Integration |
| **Integration Engineer** | Sección 7 (Infraestructura) — en paralelo con Security |
| **Quality Gate** | Validación determinista + LLM opcional (tier B); `{ ok, blockers, gaps[] }`; sustituye Auditor + `delivery_gate` |
| **Diagram Injector** | Inyecta diagramas Mermaid desde SQL y contenido |
| **Graph Populator** | Sincroniza MDD a Falkor SDD (fire-and-forget) |

**Eliminados del grafo lean (2026-07):** Architect Critic, Auditor automático, redactor, executor, delivery_gate loop. `mdd-auditor.node.ts` se conserva solo para auditoría manual (`MddManualAuditService`).

**Memoria:** LangGraph checkpoints en PostgreSQL (`AgentStateCheckpoint`).  
**Límite de recursión:** `LANGGRAPH_RECURSION_LIMIT` (default 100, env 10–500).

### 3.4 Fase 0 (DBGA)

Flujo de Benchmark & Gap Analysis:
1. **Scout** — investigación de mercado (Tavily + web)
2. **Tech Auditor** — análisis técnico de competidores
3. **Critic** — validación y re-investigación
4. **Synthesis** — documento DBGA final
5. **Deep Research** — endpoint separado `POST /projects/:id/phase0-deep-research`

---

## 4. Motor de Estimación (`packages/business-rules`)

### 4.1 Fuente única de verdad

**`@theforge/business-rules`** contiene todas las constantes y fórmulas. El servicio Nest `CostCalculatorService` y el front (`apps/web/src/utils/costCalculator.ts`) importan el mismo paquete.

### 4.2 Fórmulas

- **Horas base:** entidades × 12 + pantallas × 16 + endpoints extra × 4
- **Multiplicadores:** `TechnicalMetadata` (tags en §2 del MDD)
- **Horas fijas:** metadata + sección infra
- **Buffer semáforo:** 1.25 si status ≠ VERDE
- **Total MXN (nómina interna):** horas totales × **$185/h** (`INTERNAL_HOUR_RATE`)
- **Total MXN (mercado):** horas totales × **$1,050/h** (`MARKET_HOUR_RATE`)
- **Tarifas por rol (vista equipo):** Architect $1,500, Back $950, Front $850, UX $750

### 4.3 Semáforo de Calidad

| Estado | Condición |
|---|---|
| **ROJO** (<85) | Sin entidades, sin `business_core`, o gaps críticos en constitución |
| **AMARILLO** (85–94) | Entidades presentes pero faltan `edge_cases`, `field_types`, o puertas de constitución |
| **VERDE** (≥95) | Checklist MDD completo, o grafo SDD coherente que alivia gaps documentales |

El Semáforo combina:
- Complejidad del proyecto (LOW/MEDIUM/HIGH)
- Reglas de constitución (template_detected, glosario, Gherkin, bloqueantes)
- Alivio por grafo SDD (`sddDomainGraphOk`) — si el grafo Falkor es coherente, puede alcanzar VERDE aunque falten textos documentales
- Precisión ajustada por rol y gate de BRD/To-Be

---

## 5. Grafo SDD (FalkorDB)

Instancia **FalkorDB** en el mismo stack Docker (`theforge-falkor-sdd`) para el grafo documental **por etapa**.

### 5.1 Nodos y relaciones

| Nodo | Relaciones |
|---|---|
| `Project` | `HAS_STAGE → Stage` |
| `Stage` | `IMPLEMENTS → MDD_Section`, `OWNS_ENTITY → DB_Entity`, `DEFINES → API_Endpoint` |
| `LegacyStage` | `DERIVED_FROM → LegacyStage` (cambios en cascada legacy) |
| `MDD_Section` | `DESCRIBES → DB_Entity`, `SPECIFIES → API_Endpoint` |
| `DB_Entity` | campos, tipos, relaciones |
| `API_Endpoint` | método, ruta, `CONSUMES → DB_Entity` |

### 5.2 Consultas desde agentes

- `query_sdd_graph` / `supervisor_query_sdd_graph` — Cypher de solo lectura
- `patch_mdd_section` — enmienda §3/§4 desde extractos
- `propose_mdd_amendment` — alinear MDD con deltas de Blueprint/API

Variables: `FALKORDB_SDD_URL` / `FALKORDB_URL` (distinto de `REDIS_URL` de cola BullMQ).

---

## 6. Flujo Legacy

### 6.1 Integración con AriadneSpecs MCP

TheForge se conecta al MCP de **AriadneSpecs** (código indexado del cliente) vía HTTP JSON-RPC (Streamable HTTP).

| Componente | URL / Identidad |
|---|---|
| MCP AriadneSpecs | `THEFORGE_MCP_URL` (externa, HTTP JSON-RPC) |
| Cliente MCP en API | `TheForgeService` (Nest, `modules/theforge/`) |
| Auth | `MCP_AUTH_TOKEN` (Bearer) o `MCP_X_M2M_TOKEN` |
| Timeout estándar | `THEFORGE_MCP_TIMEOUT_MS` (default 60s) |
| Timeout ask_codebase | `THEFORGE_MCP_ASK_CODEBASE_TIMEOUT_MS` (default 15 min) |

### 6.2 Flujo legacy completo

1. **Start** → `get_modification_plan` → archivos a modificar + preguntas de negocio
2. **Answer** → respuestas del usuario + `ask_codebase` para contexto
3. **Generate As-Is** → `POST /legacy/generate-as-is-manual` (desde `codebaseDoc`)
4. **Suggest BRD/To-Be** → borradores desde `codebaseDoc`
5. **Generate MDD** → MDD de cambio (prompt incremental desde etapa base)
6. **Generate Deliverables** → cascada completa (Spec, Blueprint, API, Flujos, Infra, Tasks)

### 6.3 Guardarraíles

- **Índice vs SDD:** `assertLegacyIndexSddGate` cruza índice MCP con Falkor SDD; si hay discrepancia grave, 409 con `LEGACY_INDEX_SDD_MISMATCH`
- **BRD/To-Be (retirado jul 2026):** el campo `requireBrdTobeGate` persiste en Prisma pero `enforceLegacyBrdTobeGate` ya no bloquea MDD ni entregables; BRD sigue siendo opcional por etapa
- **Etapas como cambios:** cada etapa legacy es un `Stage` independiente con FalkorDB `DERIVED_FROM` entre etapas por ordinal

### 6.4 Variables de entorno legacy

Todas las variables `LEGACY_*` documentadas en `README.md` y `.env.example` controlan thresholds de evidencia, síntesis, paralelismo, timeouts y debug.

---

## 7. Configuración de Despliegue (Dokploy-Ready)

### 7.1 Servicios (`docker-compose.yml`)

| Servicio | Rol | Puerto |
|---|---|---|
| `theforge-db` | PostgreSQL 15 | Interno |
| `theforge-redis-queue` | Redis BullMQ (colas) | Interno |
| `theforge-falkor-sdd` | FalkorDB (grafo SDD) | Interno (`6380:6379` expuesto) |
| `theforge-api` | NestJS API | `3000` (interno, expuesto) |
| `theforge-web` | Nginx sirviendo React build | `80` (frontend público) |
| `theforge-mcp` | MCP Server propio | `3100` (interno) |

### 7.2 Redes

Red única `theforge-app-network` para evitar saturación de pools Docker. Comunicación interna por nombres de servicio Docker (ej. `theforge-api:3000`), nunca `localhost`.

### 7.3 Variables obligatorias en producción

- `JWT_SECRET`, `DATABASE_URL`, `OPENROUTER_API_KEY`
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`
- `CORS_ORIGINS`
- `THEFORGE_MCP_URL` + `MCP_M2M_SECRET` (si hay MCP Ariadne)
- `MCP_M2M_SECRET` (para auth del MCP server propio)

---

## 8. MCP Server Propio (`@theforge/mcp-server`)

Paquete en `packages/mcp-server` que expone la API Nest como herramientas MCP (stdio o HTTP Streamable).

### 8.1 Autenticación

`MCP_M2M_SECRET` → `POST /auth/mcp-login` → JWT en memoria, reintento automático en 401.

### 8.2 Herramientas principales

- **Proyectos:** `list_projects`, `get_project`, `create_project`, `delete_project`
- **Etapas:** `get_project_stages`, `create_stage`, `patch_workshop_stage`
- **Entregables:** `generate_deliverables`, `generate_spec`, `generate_blueprint`, `generate_api_contracts`, `generate_use_cases`, `generate_user_stories`, `generate_logic_flows`, `generate_infra`
- **IA/Análisis:** `start_analysis`, `get_estimation`, `get_adrs`, `review_mdd`, `orchestrator_chat`
- **Legacy:** `legacy_start`, `legacy_answer`, `legacy_generate_mdd`, `legacy_generate_codebase_doc`, `legacy_generate_deliverables`, `legacy_suggest_brd_tobe`
- **Benchmark/DBGA:** `generate_benchmark`, `phase0_deep_research`, `suggest_brd_tobe_from_dbga`
- **Conformance:** `get_conformance`
- **Sesiones:** `create_session`, `get_session`, `get_project_sessions`, `chat_in_session`

---

## 9. Entregables y Orden SDD

El MDD es la **Constitución**. Orden de generación de entregables:

1. **Spec** (Benchmark + clarifiedScope)
2. **Blueprint** (plan técnico — este documento)
3. **Casos de Uso** (derivados del MDD/Spec)
4. **Historias de usuario** (derivadas)
5. **Guía UX/UI** (chat con MDD + Blueprint como contexto)
6. **Contratos API** (desde MDD §4 + Blueprint)
7. **Flujos de lógica** (desde MDD §5)
8. **Infraestructura** (desde MDD §7 + Blueprint)
9. **Tasks** (desde MDD + Blueprint — checklist de implementación)

**Validación:** Todos los entregables pasan por validación de conformidad contra el MDD y pueden regenerarse con `gapsFeedback`.

---

## 10. Notas para Agentes (IDE / MCP)

1. **Lee `blueprint.md` + `mdd.md` + `THEFORGE-INDEX.md`** antes de tocar el código.
2. **Stage es la unidad SDD — no modifiques `Project.mddContent` directamente.**
3. **IA vía BYOK o OpenRouter** — no importes SDKs de LLM fuera de `adapters/`.
4. **FalkorDB y Ariadne MCP son cosas distintas** — no mezcles URLs ni contractos.
5. **BRD/To-Be gate retirado (jul 2026)** — `requireBrdTobeGate` ya no bloquea; BRD opcional por etapa.
6. **Planes y estimaciones** — las constantes viven en `@theforge/business-rules`.
7. **Pipeline MDD lean** — Quality Gate en `ai-analysis/`; sin Auditor/Critic en grafo.
