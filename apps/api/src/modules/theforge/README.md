# Módulo TheForge (cliente MCP)

Integración HTTP JSON-RPC con el MCP AriadneSpecs (`THEFORGE_MCP_URL`): proyectos, `get_modification_plan`, `ask_codebase`, búsqueda semántica, contenido de archivo y herramientas SDD (`validate_before_edit`, etc.).

## Contexto evidencia-primero (legacy / entregables)

`theforge-evidence-context.util.ts` arma Markdown de contexto para **SDD legacy**:

1. Varios `semantic_search` (límite configurable).
2. Extracción heurística de rutas desde el texto MCP (`extractCandidatePathsFromMcpText`).
3. `get_functions_in_file` por rutas candidatas (tope configurable).
4. `get_file_content` en rutas prioritarias (p. ej. `schema.prisma`, `package.json`).
5. Opcional: un `ask_codebase` con prompt acotado a “solo evidencia” (`twoPhase: true`).

La API Nest `TheForgeService.getContextForDeliverables` y `LegacyCoordinatorService.generateCodebaseDoc` / `generateMdd` usan este pipeline cuando `LEGACY_EVIDENCE_FIRST_CONTEXT` está activo (default).

Variables relevantes: ver `.env.example` en la raíz del monorepo (prefijo `LEGACY_*`).
