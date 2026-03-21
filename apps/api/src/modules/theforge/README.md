# Módulo TheForge

Integración con el MCP de TheForge (FalkorSpecs) para listar proyectos indexados y enriquecer el chat en proyectos legacy.

- **TheForgeService:** `listKnownProjects()`, `getModificationPlan(userDescription, projectId, opts?)`, `askCodebase(question, projectId, opts?)`, `getFileContent`, `validateBeforeEdit`, `getLegacyImpact`, etc. — llamadas al MCP FalkorSpecs (SPEC-MCP-001) con `THEFORGE_MCP_URL` y `MCP_AUTH_TOKEN`.
- **TheForgeController:** `GET /theforge/projects` → `{ projects, theforgeAvailable }`.

Env: `THEFORGE_MCP_URL`, `MCP_AUTH_TOKEN`, `THEFORGE_MCP_TIMEOUT_MS` (opcional).

Ver `docs/integración theforge/PLAN-IMPLEMENTACION-THEFORGE-WEB.md` y `docs/integración theforge/theforge.md`.
