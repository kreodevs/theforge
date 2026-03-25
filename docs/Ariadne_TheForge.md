# Ariadne + The Forge — seguimiento y pendientes

Notas para retomar el trabajo (integración legacy SDD, evidencia primero, MCP).

---

## Ya implementado (referencia rápida)

### The Forge (`apps/api`)

- Pipeline **evidencia primero**: `theforge-evidence-context.util.ts` (semantic_search → rutas → `get_functions_in_file` → `get_file_content` → `ask_codebase` con `responseMode: 'evidence_first'` + `twoPhase: true`).
- Flag **`LEGACY_EVIDENCE_FIRST_CONTEXT`** (default activo); variables `LEGACY_*` en `.env.example`.
- `getContextForDeliverables`, `generateCodebaseDoc`, `generateMdd` integrados; límite de contexto MDD `LEGACY_MDD_THEFORGE_CONTEXT_MAX_CHARS`.
- `LegacyReviewerService`: aviso si el MDD tiene pocas citas de rutas.
- Tests: `npm test` en `apps/api` corre todos los `*.spec.js` en `dist` (incl. `mdd-structured-to-markdown`).

### Ariadne

- **Ingest** — `ChatRequest.responseMode`: `evidence_first` (two-phase forzado, prompt SDD, `CHAT_EVIDENCE_FIRST_MAX_CHARS`, más tokens al sintetizador).
- **MCP** — `ask_codebase` acepta `responseMode` y lo reenvía al POST del chat.
- **Índice** — extensiones **`.mjs` / `.cjs`** en Bitbucket, GitHub, git-clone y `producer` (`EXT_CANDIDATES`).

---

## Pendiente para mañana (operativo)

1. **Desplegar** servicios Ariadne actualizados: **ingest** y **mcp-ariadne** (código nuevo en ambos).
2. **Resync / reindexar** repositorios en Ariadne para que entren al grafo los archivos `.mjs` y `.cjs` ya existentes.
3. **Validar en entorno real** un flujo legacy completo: `generate-codebase-doc` → `start` → `generate-mdd` → entregables; revisar si la telemetría **`CHAT_TELEMETRY_LOG=1`** en ingest muestra mejor `pathGroundingRatio` con `evidence_first`.
4. Revisar **coste/latencia**: el pipeline evidencia hace más llamadas MCP (semantic × N, functions × M, file content × K); ajustar topes `LEGACY_*` si hace falta.

---

## Pendiente técnico (backlog)

### Ariadne / ingest

- **Parsers / cobertura**: hoy el AST rico es JS/TS vía Tree-sitter. Valorar sin YAGNI:
  - archivos **solo texto** en grafo (p. ej. `schema.prisma`, migraciones `.sql`, configs `.yaml`) para RAG/`get_file_content` ya parcialmente cubierto por el retriever, pero no como nodos de símbolos.
  - **Vue / Svelte** si hay repos que lo usen.
- **Modo chat adicional** (opcional): más afinado que `evidence_first` (p. ej. salida casi solo JSON de retrieval) si aún hay alucinación en casos concretos.
- **Documentar** en un solo sitio (README ingest + este doc) el contrato `responseMode` para equipos que llamen al HTTP sin MCP.

### The Forge

- Pasar **`responseMode: 'evidence_first'`** (o revisar prompts) en otras llamadas **`askCodebase`** del legacy (`start` fallback, sugerencias de respuestas, preguntas MDD q1–q3) si tras pruebas sigue habiendo síntesis demasiado libre.
- **Caché** opcional de contexto TheForge por `theforgeProjectId` + ref/commit (cuando Ariadne exponga ref estable en list/sync).
- **Blueprint / MDD**: si quieres reflejar en `blueprint.md` el flujo legacy evidencia-primero y dependencias de env (una sección corta).

### Cuaderno SDD (NotebookLM)

- **Versionar** el knowledge pack en `legacy-flow/knowledge/specification-driven-development.md` cuando el cuaderno cambie; anotar fecha o enlace de export.

### Workspace / repo

- Si usas multi-root **Ariadne + theforge**: decidir si `Ariadne_TheForge.md` vive solo en The Forge (`docs/`) o duplicar/enlazar en Ariadne para quien trabaje solo ese repo.

---

## Variables de entorno a tener presentes

| Dónde | Variable | Notas |
|--------|-----------|--------|
| The Forge API | `LEGACY_EVIDENCE_FIRST_CONTEXT`, `LEGACY_*` | Ver `.env.example` raíz monorepo |
| The Forge API | `THEFORGE_MCP_URL`, tokens MCP | Cliente hacia Ariadne MCP |
| Ingest Ariadne | `CHAT_TWO_PHASE`, `CHAT_TELEMETRY_LOG` | Grounding / diagnóstico |
| Ingest Ariadne | `CHAT_EVIDENCE_FIRST_MAX_CHARS` | Solo aplica con `responseMode: evidence_first` |
| Ingest Ariadne | `INDEX_TESTS` | Si necesitas indexar `*.test.*` |

---

## Archivos clave tocados (para diff / PR)

- The Forge: `theforge-evidence-context.util.ts`, `theforge.service.ts`, `legacy-coordinator.service.ts`, `legacy-reviewer.service.ts`, `legacy-documentation-prompt.md`, `docs/LEGACY-EVIDENCE-CONTEXT.md`, `.env.example`.
- Ariadne: `services/ingest/src/chat/chat.service.ts`, `services/ingest/src/chat/README.md`, `services/ingest/README.md`, providers `bitbucket` / `github` / `git-clone`, `pipeline/producer.ts`, `services/mcp-ariadne/src/index.ts`.

---

*Última actualización: seguimiento post-implementación evidencia primero + `responseMode` + `.mjs`/`.cjs`.*
