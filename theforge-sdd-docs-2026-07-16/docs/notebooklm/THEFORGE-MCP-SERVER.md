# MCP servidor The Forge (`@theforge/mcp-server`)

Paquete **`packages/mcp-server`** del monorepo The Forge: servidor **MCP propio** que expone la **API REST Nest** (`apps/api`) como herramientas MCP. **No es** el MCP **AriadneSpecs** (código indexado del cliente); ese sigue siendo externo (`THEFORGE_MCP_URL` → oráculo Ariadne). Este servidor es **The Forge sobre The Forge**: IDE u orquestador llama al MCP → JWT M2M → mismo backend que la web.

**Última revisión:** 2026-07-16 (paridad `packages/mcp-server/src/index.ts`, revisión JSDoc 9).

---

## 1. Propósito y transporte

| Aspecto | Detalle |
|--------|---------|
| **Paquete** | `@theforge/mcp-server` (`pnpm --filter @theforge/mcp-server build`) |
| **Binario** | `theforge-mcp` → `dist/index.js` |
| **Modo stdio** | Por defecto (sin args): Cursor / Claude Desktop ejecutan el binario. |
| **Modo HTTP** | `0.0.0.0:$PORT` (default **3000**). `GET /health` sin auth. Healthcheck compose: `http://theforge-mcp:3000/health` (DNS servicio; **no** `127.0.0.1` en Dokploy UI — es el host). Swarm: `http://localhost:3000/health` dentro del task. `POST /` + `MCP_M2M_SECRET`. Traefik: `/mcp` → raíz. |
| **Backend** | `THEFORGE_API_URL` (default `http://localhost:3000`) — misma API que el front. |

---

## 2. Autenticación

- **`MCP_M2M_SECRET`** (obligatoria): mismo valor que en la API Nest (`POST /auth/mcp-login` con `{ "secret": "..." }`).
- El servidor obtiene **JWT**, lo guarda en memoria y reintenta **una vez** en **401** tras re-login.
- Timeout por petición a la API: **`THEFORGE_MCP_TIMEOUT`** (ms), default **120000**.

Sin `MCP_M2M_SECRET`, `login()` lanza error al primer uso autenticado.

### 2.1 `fetch failed` en login (producción)

El arranque hace `POST ${THEFORGE_API_URL}/auth/mcp-login`. **`fetch failed`** (Node) casi siempre es **red / URL**, no credenciales.

| Causa | Qué hacer |
|--------|-----------|
| **`THEFORGE_API_URL` por defecto** (`http://localhost:3000`) dentro de un contenedor MCP | `localhost` es el propio contenedor. Usa el **hostname del servicio API** en la misma red Docker (ej. `http://theforge-api:3000` como en `docker-compose.yml`). En Dokploy, define el env apuntando al servicio interno que exponga Nest. |
| API aún no levantada | Orden de arranque / `depends_on` con healthcheck; el MCP reintenta login en cada herramienta, pero conviene que la API responda antes. |
| TLS / HTTPS mal configurado | Si la API solo escucha HTTP interno, no mezcles `https://` sin certificado válido para ese host. |

El binario **ya no** usa `node --experimental-network-imports` (era ruido en logs y no hace falta para el SDK empaquetado en `node_modules`).

---

## 3. Inventario de herramientas (alto nivel)

Definidas en `packages/mcp-server/src/index.ts` (`TOOLS` + `handlers`). Catálogo JSDoc: `src/mcp-tools.doc.ts` (`MCP_THEFORGE_TOOLS_DOC_REVISION = 9`).

### Proyectos y etapas

- `list_projects`, `get_project`, `create_project`, `delete_project`, `patch_project`
- `get_project_deliverables`, `get_project_stages`, `get_project_stage_detail`
- `create_project_stage`, `patch_project_stage`, `transition_project_stage`
- `get_conformance`, `merge_projects`, `get_change_log`, `get_project_tables`

### Grupos de proyectos (admin+ salvo list/get)

- `list_project_groups`, `get_project_group`, `create_project_group`, `rename_project_group`, `delete_project_group`, `move_project_to_group`, `move_project_group_to_first`

### Fase 0 / DBGA

- `generate_benchmark`, `phase0_deep_research`, `generate_phase0`, `suggest_brd_tobe_from_dbga`, `start_analysis`

### Entregables SDD

- `generate_deliverables`, `generate_spec`, `generate_blueprint`, `generate_architecture`, `generate_api_contracts`, `generate_use_cases`, `generate_user_stories`, `generate_logic_flows`, `generate_infra`
- `generate_agent_governance`, `get_agent_governance_export`
- `confirm_complexity`, `reassess_complexity`, `get_job_status` (polling colas async)

### MDD / estimación

- `get_estimation`, `get_mdd_thread`, `get_adrs`, `review_mdd`

### Orquestador y sesiones

- `orchestrator_chat`, `orchestrator_welcome`, `orchestrator_clear_chat`
- `create_session`, `get_project_sessions`, `get_session`, `chat_in_session`

### Legacy (Ariadne / MaxPrime)

- `legacy_start`, `legacy_answer`, `legacy_generate_mdd`, `legacy_generate_codebase_doc`, `legacy_generate_deliverables`, `legacy_update_codebase_doc`
- `legacy_generate_as_is_manual`, `legacy_suggest_brd_tobe`, `legacy_resolve_index_sdd_conflict`
- `legacy_interview_start`, `legacy_interview_chat`, `legacy_interview_confirm`, `legacy_interview_status`
- `legacy_resolve_change_to_files`, `legacy_check_navigation_impact`, `legacy_transition_status`, `legacy_execute_transition`

### Spec-kit / implementación / doc gap

- `get_next_implementation_task`, `get_tasks_json`
- `report_documentation_gap`, `get_agent_session_log`
- `generate_markdown_table`, `normalize_markdown_table`, `generate_mermaid`, `normalize_mermaid`

### Integración externa

- `list_theforge_projects` — índice Ariadne multi-root
- `set_aem_content` — contenido AEM desde apps externas

Los nombres exactos y `inputSchema` están en el código; ejecuta `tools/list` contra la versión desplegada para validar paridad.

---

## 4. Despliegue rápido

```bash
# En la raíz del monorepo
corepack enable
pnpm install
pnpm exec turbo run build --filter=@theforge/mcp-server
export MCP_M2M_SECRET=...   # mismo que apps/api
export THEFORGE_API_URL=http://localhost:3000
node packages/mcp-server/dist/index.js --http   # PORT / 3100
```

**Cursor (`mcp.json`):** servidor con `url` apuntando a `http://localhost:3100/mcp` (o la ruta que exponga el transport HTTP del SDK) **solo** si el binario publica ese endpoint; ver implementación actual de `StreamableHTTPServerTransport` en `index.ts`.

**Stdio:** comando `node /ruta/al/theforge/packages/mcp-server/dist/index.js` sin `--http`.

---

## 5. Relación con otros MCP

| MCP | Rol |
|-----|-----|
| **AriadneSpecs** (`THEFORGE_MCP_URL` en la API) | Grafo de **código** del cliente (Falkor + ingest). Usado por `TheForgeService` en legacy, Blueprint, etc. |
| **`@theforge/mcp-server` (este doc)** | Herramientas sobre **proyectos The Forge**, MDD, entregables, orquestador, flujo legacy. |

No mezclar URLs ni secretos: M2M de The Forge ≠ `MCP_AUTH_TOKEN` de Ariadne.

---

## 6. Mantenimiento

- Cada nuevo endpoint expuesto al producto que deba ser invocable desde agentes debería añadirse como **tool** + **handler** en `mcp-server`.
- Tests de contrato: en la API existen pruebas de alineación MCP cliente (Ariadne); para este servidor, validar manualmente `tools/list` contra la versión desplegada de la API.

---

*Corpus «The Forge - by Kreo» — NotebookLM sync 2026-07-16 (pnpm). Rutas relativas al monorepo `theforge`.*
