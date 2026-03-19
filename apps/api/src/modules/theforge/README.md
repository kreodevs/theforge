# Módulo TheForge

Integración con el MCP de TheForge (FalkorSpecs) para listar proyectos indexados y enriquecer el chat en proyectos legacy.

- **TheForgeService:** `listKnownProjects()`, `getModificationPlan(userDescription, projectId)`, `askCodebase(question, projectId)` — llamadas al MCP con `THEFORGE_MCP_URL` y `THEFORGE_M2M_TOKEN`.
- **TheForgeController:** `GET /theforge/projects` → `{ projects, theforgeAvailable }`.

Env: `THEFORGE_MCP_URL`, `THEFORGE_M2M_TOKEN`, `THEFORGE_MCP_TIMEOUT_MS` (opcional).

Ver `docs/integración theforge/PLAN-IMPLEMENTACION-THEFORGE-WEB.md` y `docs/integración theforge/theforge.md`.
