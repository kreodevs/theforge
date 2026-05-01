# TheForge

Monorepo Turborepo: API NestJS + Web React (Vite) + Prisma. LLM vía **OpenRouter**, Semáforo MDD, motor de estimación MXN. Despliegue Dokploy-ready con Docker.

## Estructura

- **apps/api** — NestJS: proyectos, sesiones, AI (OpenRouter), engine (cost-calculator, semáforo).
- **apps/web** — React (Vite) + Tailwind.
- **packages/database** — Prisma schema y client.
- **packages/shared-types** — DTOs e interfaces (Zod).
- **packages/config** — TS, ESLint, Tailwind base.

## Requisitos

- Node ≥20
- npm (workspaces en la raíz; opcional `package-lock.json` para builds reproducibles / `npm ci` en CI)
- PostgreSQL 15 (para API)
- Opcional: Redis (para colas futuras)

## Desarrollo

```bash
npm install
# Base de datos: crear DB y DATABASE_URL en .env (api o root)
npm run db:generate
npm run db:push
npm run dev
```

- API: http://localhost:3000
- Web: http://localhost:5173 (proxy /api → 3000)

## Build

```bash
npm run build
```

## Docker (Dokploy) — un solo contenedor

Un único contenedor **theforge-db** con Postgres + API + Web (Nginx). Conexión interna: `postgresql://theforge:theforge@localhost:5432/theforge`.

Las imágenes (`Dockerfile` raíz, `apps/api/Dockerfile`, `apps/web/Dockerfile`) instalan dependencias con **`npm install`** en el contexto del monorepo (copian `package.json`, `turbo.json`, `.npmrc` y los `package.json` de workspaces). Cuando tengas un **`package-lock.json` en la raíz** generado con `npm install`, puedes cambiar el `Dockerfile` a `COPY package-lock.json ./` + `npm ci` para builds más deterministas.

```bash
docker compose up --build
```

- **Contenedor:** `theforge-db` (nombre del servicio y del contenedor)
- **Puerto:** 80 (Web + proxy `/api` → API en el mismo contenedor)
- **Volumen:** `theforge_db_data` (datos de Postgres)

Variables de entorno: referencia completa a continuación. Alternativamente, revisa `.env.example` en la raíz.

## Variables de Entorno — Referencia Completa

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `NODE_ENV` | `development` | api | Modo Node/Nest: `development` | `production` | `test` |
| `PORT` | `3000` | api | Puerto HTTP del API Nest |
| `DATABASE_URL` | — | api | PostgreSQL (Prisma): `postgresql://USER:PASS@HOST:PORT/DB` |
| `REDIS_URL` | — (sin cola) | api | BullMQ. Si vacío, generate-deliverables corre síncrono |
| `CORS_ORIGINS` | — | api | Orígenes CORS permitidos (coma). **Obligatorio en production** |
| `WEB_DOMAIN` | — | api | Host canónico del frontend (opcional) |
| `JWT_SECRET` | — | api | **Obligatorio en production.** Firma JWT |
| `JWT_EXPIRES_IN` | `7d` | api | Caducidad del JWT (formato `ms`: ej. `7d`, `24h`) |
| `EMAIL_OTP` | — | api | Único email autorizado para OTP (whitelist) |
| `AUTH_ALLOWED_OTP_EMAIL` | — | api | Alias legacy del correo OTP |
| `SMTP_HOST` | — | api | Servidor SMTP (obligatorio en production) |
| `SMTP_PORT` | `587` | api | Puerto SMTP |
| `SMTP_SECURE` | `0` | api | `1` = SSL directo; `0` = STARTTLS (típ. con puerto 587) |
| `SMTP_USER` | — | api | Usuario SMTP |
| `SMTP_PASS` | — | api | Contraseña SMTP |
| `SMTP_FROM` | — | api | Remitente del correo (From) |

### 🔷 OpenRouter / LLM

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `OPENROUTER_API_KEY` | — | api | **Clave principal.** Preferida sobre AI_API_KEY / OPENAI_API_KEY |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | api | URL base del proveedor OpenAI-compatible |
| `OPENROUTER_CHAT_MODEL` | `nousresearch/hermes-3-llama-3.1-405b` | api | Modelo de chat |
| `OPENROUTER_EMBEDDING_MODEL` | `openai/text-embedding-3-small` | api | Modelo de embeddings |
| `OPENROUTER_EMBEDDING_API_KEY` | — | api | Clave dedicada solo para embeddings (opcional) |
| `OPENROUTER_HTTP_REFERER` | — | api | HTTP Referer para ranking en openrouter.ai |
| `OPENROUTER_APP_TITLE` | — | api | Título de app en dashboard openrouter.ai |
| `AI_API_KEY` | — | api | Alias de clave si no usas OPENROUTER_API_KEY |
| `OPENAI_API_KEY` | — | api | Alias de clave |
| `OPENAI_EMBEDDING_DIM` | `1536` | api | Dimensión de vectores embedding (OpenAI small) |
| `EMBEDDING_DIM` | `1536` | api | Alias de OPENAI_EMBEDDING_DIM |
| `LLM_EMBEDDINGS_PROVIDER` | — | api | `none` / `off`: desactiva embeddings (RAG limitado) |
| `TAVILY_API_KEY` | — | api | Búsqueda web Scout (opcional) |

### 🔷 MCP AriadneSpecs

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `THEFORGE_MCP_URL` | — | api | URL del MCP AriadneSpecs (Streamable HTTP). Vacío = MCP desconfigurado |
| `MCP_AUTH_TOKEN` | — | api | Bearer token hacia el MCP (si aplica) |
| `MCP_X_M2M_TOKEN` | — | api | Cabecera X-M2M-Token alternativa |
| `MCP_M2M_SECRET` | — | api | Secreto compartido api ↔ mcp para login JWT. **Debe ser idéntico en ambos servicios** |
| `THEFORGE_MCP_TIMEOUT_MS` | `60000` | api | Timeout (ms) por llamada JSON-RPC al MCP (herramientas rápidas) |
| `THEFORGE_MCP_ASK_CODEBASE_TIMEOUT_MS` | `900000` (15 min) | api | Timeout solo para `ask_codebase` (ingest puede tardar minutos) |
| `THEFORGE_API_URL` | `http://localhost:3000` | mcp | URL de la API Nest **desde el proceso MCP** |

### 🔷 Caché y Debug

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `THEFORGE_CONTEXT_CACHE` | `1` (activo) | api | Caché en memoria del contexto MCP |
| `THEFORGE_CONTEXT_CACHE_TTL_MS` | `1800000` (30 min) | api | TTL en ms de la caché (mín. 60000) |
| `THEFORGE_CONTEXT_CACHE_MAX_ENTRIES` | `80` | api | Máximo entradas en caché (mín. 8) |
| `THEFORGE_CONTEXT_REVISION` | — | api | Bump manual para invalidar caché (cualquier string) |
| `THEFORGE_LIST_PROJECTS_CACHE_MS` | `60000` | mcp | TTL en ms de caché list_known_projects. `0` = sin caché |
| `AGENT_EVALUATOR_LEGACY` | `false` | api | Incluir evaluador legacy en respuesta |
| `LANGGRAPH_RECURSION_LIMIT` | `100` | api | Pasos LangGraph por invocación. Rango 10–500 |
| `DEBUG_MDD_SECTION3` | `0` | api | Log detallado de §3 MDD |
| `DEBUG_MCP` | `0` | api | Log petición/respuesta MCP |
| `DEBUG_MCP_MAX_REQUEST_CHARS` | `65536` | api | Truncado de log request MCP |
| `DEBUG_MCP_MAX_RESPONSE_CHARS` | `32768` | api | Truncado de log response MCP |
| `LEGACY_CODEBASE_DOC_MCP_DEBUG_UI` | `0` | api | Devolver mcpDebugTrace en doc de partida |
| `LEGACY_DELIVERABLES_DEBUG` | `0` | api | Logs detallados por paso en generate-deliverables |

### 🔷 FalkorDB / SDD

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `FALKORDB_SDD_URL` | — (usa FALKORDB_URL) | api | URL específica para SDD (prioridad sobre FALKORDB_URL) |
| `FALKORDB_URL` | `redis://localhost:6379` | api | URL genérica Redis/Falkor para grafo SDD |

### 🔷 Legacy — Evidencia y Descubrimiento

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `LEGACY_EVIDENCE_FIRST_CONTEXT` | `1` (activo) | api | Pipeline evidencia-primero |
| `LEGACY_EVIDENCE_MAX_PATHS` | `35` | api | Rutas candidatas en evidencia |
| `LEGACY_EVIDENCE_FUNCTIONS_PATHS` | `20` | api | Rutas con get_functions |
| `LEGACY_EVIDENCE_FULL_FILE_PATHS` | `3` | api | Extractos de archivo completo |
| `LEGACY_FILE_CONTENT_MAX_CHARS` | `4000` | api | Recorte get_file_content en evidencia |
| `LEGACY_SEMANTIC_SEARCH_LIMIT` | `80` | api | Límite hits semantic_search MCP |
| `LEGACY_SEMANTIC_SECTION_MAX_CHARS` | `16000` | api | Recorte bloque semántico |
| `LEGACY_SEMANTIC_KEEP_MARKDOWN_DOCS` | `0` | api | Conservar MarkdownDoc en semántica |
| `LEGACY_SYNTHESIS_INPUT_MAX_CHARS` | `28000` | api | Tope evidencia → síntesis ask_codebase |
| `LEGACY_MDD_THEFORGE_CONTEXT_MAX_CHARS` | `24000` | api | Tope bloque TheForge en MDD coordinador |
| `LEGACY_C4_CONTEXT` | `1` (activo) | api | Incluir C4 desde MCP |
| `LEGACY_C4_MAX_CHARS` | `5000` | api | Recorte markdown C4 |
| `THEFORGE_CONTEXT_PREPEND_MAX_CHARS` | `16000` | api | Tope prepend C4+evidencia en prompts |
| `LEGACY_STAGED_DISCOVERY_MAX_TOOL_ROUNDS` | `18` | api | Rondas de tools en descubrimiento escalonado |
| `LEGACY_STAGED_DISCOVERY_OUTPUT_MAX_CHARS` | `96000` | api | Tope salida MDD del agente |
| `LEGACY_STAGED_DISCOVERY_SEMANTIC_FLOOR` | `80` | api | Mínimo efectivo de `limit` en semantic_search del agente ReAct |
| `LEGACY_CODEBASE_DOC_INDEX_SYNTHESIS` | `1` (activo) | api | Síntesis MDD desde evidencia + semántica en doc de partida |
| `LEGACY_CODEBASE_DOC_SYNTHESIS_INPUT_MAX_CHARS` | `28000` | api | Tope evidencia+semántica en prompt de síntesis doc partida |
| `LEGACY_CODEBASE_DOC_SEMANTIC_MAX_CHARS` | `48000` | api | Recorte §5 en doc de partida |
| `LEGACY_CODEBASE_DOC_PARALLEL_ASK` | `0` (secuencial) | api | `1` = cuatro ask_codebase en paralelo (más rápido, más riesgo timeout) |
| `LEGACY_ASK_CODEBASE_EVIDENCE_FIRST` | `1` (activo) | api | ask_codebase estructurado: raw_evidence + deterministicRetriever + twoPhase |
| `LEGACY_ANALYZER_COMPACT` | `1` (activo) | api | Analyzer compacto |
| `LEGACY_ANALYZER_REQUIRE_GRAPH_HITS` | `1` (activo) | api | No ejecutar Analyzer si índice vacío |
| `LEGACY_ANALYZER_ATTACH_RAW` | `0` | api | Anexar evidencia bruta en Analyzer (debug) |
| `LEGACY_ANALYZER_INPUT_MAX_CHARS` | `14000` | api | Tope evidencia → Analyzer |
| `LEGACY_SDD_INDEX_GATE` | `1` (activo) | api | Cruce índice MCP vs SDD Falkor |
| `LEGACY_SDD_RICH_MIN_ENTITIES` | `2` | api | Umbral entidades para SDD "rico" |
| `LEGACY_SDD_RICH_MIN_ENDPOINTS` | `2` | api | Umbral endpoints para SDD "rico" |
| `LEGACY_SDD_INDEX_MIN_OVERLAP_RATIO` | `0.28` | api | Solapamiento mínimo (0–1) |
| `LEGACY_SDD_MIN_ARTIFACTS_FOR_OVERLAP` | `2` | api | Mínimo artefactos para chequeo de solapamiento |

### 🔷 Entregables (Deliverables)

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `LEGACY_DELIVERABLES_INTER_STEP_DELAY_MS` | `5000` | api | Pausa entre cada paso LLM de la cascada (TPM/RPM) |
| `LEGACY_DELIVERABLES_LARGE_MDD_THRESHOLD_CHARS` | `80000` | api | Si el MDD supera este tamaño, cooldown antes del primer entregable |
| `LEGACY_DELIVERABLES_LARGE_MDD_COOLDOWN_MS` | `20000` | api | Milisegundos de espera cuando se supera el umbral |
| `LEGACY_DELIVERABLES_MDD_MAX_CHARS` | `80000` | api | Tope del texto efectivo enviado a cada paso (mín. 12000) |
| `LEGACY_DELIVERABLES_MDD_ROLLUP` | `1` (activo) | api | `1` = varias llamadas LLM por ventanas + ensamblado; `0` = truncar |
| `LEGACY_DELIVERABLES_ROLLUP_CHUNK_CHARS` | `40000` | api | Tamaño objetivo de cada ventana del MDD |
| `LEGACY_DELIVERABLES_ROLLUP_MAX_CHUNKS` | `32` | api | Máximo de ventanas por rollup |
| `LEGACY_DELIVERABLES_SECTION_MERGE` | `all` | api | Valores: `all`, `blueprint`, `auto`, `0`/`off` |
| `LEGACY_DELIVERABLES_STRATEGY_AUTO_USER_PROMPT_TOKEN_MAX` | `28000` | api | Con SECTION_MERGE=auto: tope estimado de tokens |
| `LEGACY_DELIVERABLES_STRATEGY_CHARS_PER_TOKEN` | `4` | api | Fallback chars→tokens si tiktoken no carga |
| `LEGACY_DELIVERABLES_STRATEGY_USE_TIKTOKEN` | `1` (activo) | api | `0`/`off` = solo heurística chars/ratio |
| `LEGACY_DELIVERABLES_STRATEGY_TIKTOKEN_ENCODING` | `cl100k_base` | api | BPE tiktoken |
| `LEGACY_DELIVERABLES_STRATEGY_TIKTOKEN_INSTRUCTION_OVERHEAD_TOKENS` | `450` | api | Overhead system + plantilla |
| `LEGACY_DELIVERABLES_LLM_429_MAX_RETRIES` | `5` | api | Reintentos ante 429 / resource exhausted. `0` = sin reintentos |
| `LEGACY_DELIVERABLES_LLM_429_BASE_DELAY_MS` | `15000` | api | Backoff base (ms) ×2 por intento, tope 180s |

### 🔷 Frontend (build args)

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `VITE_API_URL` | `/api` | web (build) | URL base de la API. Se inyecta al construir la imagen (build arg) |

### 🔷 Operacionales

| Variable | Default | Dónde aplica | Qué hace |
|---|---|---|---|
| `PRISMA_RESOLVE_ROLLED_BACK` | — | api | Nombre de migración rolled-back (solo cuando Prisma lo pida) |
| `WAIT_FOR_POSTGRES_ATTEMPTS` | `90` | Entrypoint | Intentos de espera Postgres al arrancar |
| `WAIT_FOR_POSTGRES_DELAY_MS` | `1000` | Entrypoint | Intervalo entre intentos (ms) |
| `CLEAN_SPEC_PROJECT_ID` | `3` | Script | Project ID para script clean-spec |

> 💡 **Dokploy production:** las obligatorias son `JWT_SECRET`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `SMTP_HOST`/`USER`/`PASS` y `CORS_ORIGINS`. Todo lo demás tiene defaults funcionales.

---

### Compose multi-servicio (`docker-compose.yml`)

`THEFORGE_MCP_URL` y `MCP_AUTH_TOKEN` **no** se interpolan con `${VAR:-}` en el servicio `theforge-api`: un valor vacío en el bloque `environment` impide que las mismas claves lleguen desde `.env` o desde las variables de **ese** servicio en Dokploy. El servicio usa `env_file: .env` (opcional, `required: false`) más lo que inyecte el orquestador en el contenedor API.

## Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) — licencia, PRs, tests.
- [docs/JSDOC.md](docs/JSDOC.md) — convenciones de documentación en código.
- [Índice de arquitectura](docs/notebooklm/THEFORGE-INDEX.md)
- [Blueprint](blueprint.md)
- [MDD](mdd.md)

## Licencia y autoría

- **Licencia:** [Apache License 2.0](LICENSE). Aviso: [NOTICE](NOTICE).
- **Autores y colaboradores:** [AUTHORS.md](AUTHORS.md).
- **Contribución y JSDoc:** [CONTRIBUTING.md](CONTRIBUTING.md) y [docs/JSDOC.md](docs/JSDOC.md).
