# @theforge/api

Backend NestJS de TheForge.

- **Módulos:** Projects (incluye **`GET/POST/PATCH …/projects/:projectId/stages`** — crear/actualizar etapa responden `{ stage }`; **`POST …/generate-deliverables`** cascada por `complexity`; generación/preview de **Contratos API** bloqueada si el Blueprint no cubre el §3 del MDD; MDD por etapa con `stageId` en PATCH), Sessions, AI (adapter OpenRouter), Engine (cost-calculator, semáforo, conformance). **Ai-orchestrator:** `POST /ai-orchestrator/welcome` acepta `stageId` opcional (contexto MDD alineado a la etapa). **Ai-analysis:** checkpoints LangGraph / `mdd/thread` por `projectId` + `mddStageId`.
- **DB:** Prisma + PostgreSQL (schema en `packages/database`).
- **IA:** un solo proveedor, **OpenRouter** (`https://openrouter.ai/api/v1` compatible OpenAI). Config: `modules/ai/config/llm-config.ts`; `OpenRouterAdapter` + `createDbgaLLM` comparten `resolvePrimaryChatRuntime`. Clave: `OPENROUTER_API_KEY` o alias `AI_API_KEY` / `OPENAI_API_KEY`. Chat: default `nousresearch/hermes-3-llama-3.1-405b` (`OPENROUTER_CHAT_MODEL`). Modelo por componente: `OPENROUTER_CHAT_MODEL_DBGA` para pipeline MDD/LangGraph (fallback `OPENROUTER_CHAT_MODEL`). Embeddings: mismo endpoint, default `openai/text-embedding-3-small` (`OPENROUTER_EMBEDDING_MODEL`); `LLM_EMBEDDINGS_PROVIDER=none` desactiva.

Env: `DATABASE_URL` y claves en `.env.example` (OpenRouter). **Auth (Fase 1):** Passport **`JwtStrategy`** + `JwtAuthGuard` global; `UserContextInterceptor` + `AsyncLocalStorage` propagan `userId` del JWT a `ProjectsService` / `SessionsService` (filtrado por propiedad). `JWT_SECRET` obligatorio en producción. **OTP:** `EMAIL_OTP` (recomendado en Docker/Dokploy) o `AUTH_ALLOWED_OTP_EMAIL` — único correo que recibe el código; en producción uno de los dos es obligatorio al arranque. SMTP como en `.env.example`; tras verify, `User` en BD y **`sub` en JWT = `User.id`**.

**CORS:** `CORS_ORIGINS` (coma) obligatorio si `NODE_ENV=production`; `docker-compose` incluye por defecto `https://theforge.kreoint.mx`, `WEB_DOMAIN` y localhost (Vite). Sobreescribe en Dokploy si el front vive en otro origen.

**BullMQ (opcional):** con `REDIS_URL`, la cascada `POST /projects/:id/generate-deliverables` se encola (`theforge-deliverables`); el cliente usa polling o `GET …/deliverables-jobs/:jobId/stream` (SSE). Sin Redis, la respuesta sigue siendo el proyecto actualizado en la misma petición.

**SSRF (scrape):** `url-ssrf-guard.ts` — resolución DNS y `ip-range-check`; usado en `scrape-cheerio.tool.ts` y `ScraperService`. Proyectos **legacy** + MCP: `THEFORGE_MCP_URL`, tokens MCP; pipeline evidencia-primero y topes en variables `LEGACY_*` (ver raíz `.env.example` y `docs/notebooklm/LEGACY-EVIDENCE-CONTEXT.md`).

## Despliegue (Docker / Dokploy)

- **ENTRYPOINT** `docker-entrypoint.sh`: (1) espera TCP a Postgres vía `scripts/wait-for-postgres.cjs`, (2) `prisma migrate deploy` desde `packages/database`, (3) arranca Nest (`main.js`).
- En la UI de Dokploy (o cualquier plataforma), **no** sustituir el comando de arranque por `node dist/main.js` solo: se saltarían las migraciones. Usar la imagen tal cual o un comando que invoque el mismo entrypoint.
- Opcional: `WAIT_FOR_POSTGRES_ATTEMPTS` (default 90), `WAIT_FOR_POSTGRES_DELAY_MS` (default 1000).
- **P3009** (`stage_sdd_deliverables`): el entrypoint intenta `migrate resolve --rolled-back` automáticamente antes de `deploy`. Otra migración atascada: `PRISMA_RESOLVE_ROLLED_BACK` o [packages/database/README.md](../../packages/database/README.md).

## Variables de entorno

⚠️ **Todas las variables LLM pasan por OpenRouter.** No existe `LLM_PROVIDER` como env en el código; el runtime es siempre OpenRouter. Para migrar a LemonData u otro proveedor, se añadiría un adapter similar a `OpenRouterAdapter` y se cambiaría `createLLMProvider()` en `ai.factory.ts`.

### Obligatorias (el API no arranca sin estas)

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL (Prisma): `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | — | Firma JWT; **obligatorio** en producción |
| `OPENROUTER_API_KEY` | — | Clave OpenRouter. Alternativas: `AI_API_KEY`, `OPENAI_API_KEY` |
| `CORS_ORIGINS` | — | Orígenes CORS separados por coma; obligatorio si `NODE_ENV=production` |
| `EMAIL_OTP` | — | Único correo que recibe código OTP (o `AUTH_ALLOWED_OTP_EMAIL`) |

### Conexiones / Infra

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `DATABASE_URL` | **Sí** | — | PostgreSQL (Prisma). Formato: `postgresql://user:pass@host:port/db` |
| `FALKORDB_SDD_URL` | No | `redis://localhost:6379` | FalkorDB (grafo documental SDD). Prioridad sobre `FALKORDB_URL` |
| `REDIS_URL` | No | — | Redis para BullMQ (cascada asíncrona generate-deliverables). Vacío = síncrono |
| `THEFORGE_MCP_URL` | No | — | URL del MCP AriadneSpecs (Streamable HTTP). Vacío = MCP desconfigurado |

### OpenRouter / LLM

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Sí** | — | Clave principal. Alternativas: `AI_API_KEY`, `OPENAI_API_KEY` |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | API base compatible OpenAI |
| `OPENROUTER_CHAT_MODEL` | No | `nousresearch/hermes-3-llama-3.1-405b` | Modelo por defecto para todo el Workshop |
| `OPENROUTER_CHAT_MODEL_DBGA` | No | `OPENROUTER_CHAT_MODEL` | Modelo para pipeline MDD/LangGraph (DBGA). Convención: `OPENROUTER_CHAT_MODEL_{COMPONENTE}` |
| `OPENROUTER_EMBEDDING_MODEL` | No | `openai/text-embedding-3-small` | Modelo de embeddings (mismo endpoint OpenRouter) |
| `OPENROUTER_EMBEDDING_API_KEY` | No | Misma que `OPENROUTER_API_KEY` | Clave dedicada solo para embeddings |
| `OPENROUTER_HTTP_REFERER` | No | — | HTTP-Referer para ranking en openrouter.ai |
| `OPENROUTER_APP_TITLE` | No | — | Título de app para openrouter.ai |
| `LLM_EMBEDDINGS_PROVIDER` | No | `openrouter` | `none` / `off` desactiva embeddings (RAG limitado) |

### Auth / OTP / SMTP

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `JWT_SECRET` | **Sí** (prod) | — | Firma JWT |
| `JWT_EXPIRES_IN` | No | `7d` | Caducidad JWT |
| `EMAIL_OTP` | **Sí** (prod) | — | Único email que recibe código OTP |
| `AUTH_ALLOWED_OTP_EMAIL` | No | — | Alias legacy de `EMAIL_OTP` |
| `SMTP_HOST` | **Sí** (prod) | — | Servidor SMTP |
| `SMTP_PORT` | No | `587` | Puerto SMTP |
| `SMTP_SECURE` | No | `0` | `1` = SSL directo, `0` = STARTTLS |
| `SMTP_USER` | **Sí** (prod) | — | Usuario SMTP |
| `SMTP_PASS` | **Sí** (prod) | — | Contraseña SMTP |
| `SMTP_FROM` | No | — | Remitente From |
| `CORS_ORIGINS` | **Sí** (prod) | — | Orígenes CORS (coma) — obligatorio en producción |

### MCP / TheForge

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `MCP_M2M_SECRET` | **Sí** | — | Secreto compartido API ↔ MCP server. Debe ser idéntico en ambos |
| `THEFORGE_MCP_URL` | No | — | URL del servidor MCP AriadneSpecs |
| `MCP_AUTH_TOKEN` | No | — | Bearer token hacia el MCP |
| `MCP_X_M2M_TOKEN` | No | — | Cabecera X-M2M-Token alternativa |
| `THEFORGE_MCP_TIMEOUT_MS` | No | `60000` | Timeout para herramientas rápidas MCP |
| `THEFORGE_MCP_ASK_CODEBASE_TIMEOUT_MS` | No | `900000` (15 min) | Timeout para `ask_codebase` (ingest puede tardar) |
| `THEFORGE_API_URL` | No | `http://localhost:3000` | Base de la API Nest desde el proceso MCP |
| `THEFORGE_LIST_PROJECTS_CACHE_MS` | No | `60000` | TTL en ms para `list_known_projects` |
| `THEFORGE_CONTEXT_CACHE` | No | `1` | Caché de contexto MCP en memoria |
| `THEFORGE_CONTEXT_CACHE_TTL_MS` | No | `1800000` (30 min) | TTL de la caché de contexto |
| `THEFORGE_CONTEXT_CACHE_MAX_ENTRIES` | No | `80` | Máximo entradas en caché de contexto |

### LangGraph / MDD Pipeline

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `LANGGRAPH_RECURSION_LIMIT` | No | `100` | Pasos máximos por invocación LangGraph |
| `LANGGRAPH_LLM_TIMEOUT_MS` | No | `300000` (5 min) | Timeout LLM en LangGraph |

### Legacy / Ariadne Evidence Pipeline

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `LEGACY_EVIDENCE_FIRST_CONTEXT` | No | `1` | Pipeline evidencia-primero |
| `LEGACY_CODEBASE_DOC_INDEX_SYNTHESIS` | No | `1` | Segunda pasada de síntesis en documentación de partida |
| `LEGACY_ANALYZER_COMPACT` | No | `1` | Analyzer compacto |
| `LEGACY_ANALYZER_REQUIRE_GRAPH_HITS` | No | `1` | No ejecutar Analyzer si el grafo está vacío |
| `LEGACY_SDD_INDEX_GATE` | No | `1` | Cruce entre índice MCP y SDD Falkor |
| `LEGACY_DELIVERABLES_SECTION_MERGE` | No | `all` | `all`, `blueprint`, `auto`, `0`/`off` |

> Tabla completa (incluyendo debugging y tuning fino) en [`.env.example`](../../.env.example) con todos los defaults documentados.
