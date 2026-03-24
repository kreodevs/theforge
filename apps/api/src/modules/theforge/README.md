# Módulo TheForge

Integración con el MCP de TheForge (AriadneSpecs) para listar proyectos indexados y enriquecer el chat en proyectos legacy.

- **TheForgeService:** `listKnownProjects()`, `getModificationPlan()`, `askCodebase()`, `getFileContent`, `validateBeforeEdit`, `getLegacyImpact`, `getContractSpecs`, `getComponentGraph`, `semanticSearch()`, `getFunctionsInFile()`, `getDefinitions()`, `getReferences()` — llamadas al MCP AriadneSpecs. Cumple spec: `MCP-Protocol-Version: 2025-03-26`, manejo de `result.isError`. Herramientas de documentación legacy: semantic_search, get_functions_in_file, get_definitions usadas en generateCodebaseDoc, getContextForDeliverables y generateMdd.
- **TheForgeController:** `GET /theforge/projects` → `{ projects, theforgeAvailable }`.

Env: `THEFORGE_MCP_URL` (obligatorio para usar MCP); `MCP_AUTH_TOKEN` o `MCP_X_M2M_TOKEN` (opcional si el servidor requiere auth); `THEFORGE_MCP_TIMEOUT_MS` (opcional, default 60000).

Contrato MCP: `docs/integración theforge/Llamadas-HTTPS-MCP-AriadneSpecs.md`. Ver también `PLAN-IMPLEMENTACION-THEFORGE-WEB.md` y `theforge.md`.
