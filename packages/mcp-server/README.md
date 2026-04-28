# @theforge/mcp-server

Servidor MCP que expone la API REST de The Forge como herramientas (`stdio` o HTTP streamable con `--http`).

## JSDoc de herramientas

- **`src/mcp-tools.doc.ts`** — catálogo documentado: cada `name` MCP, verbo HTTP y agrupación (proyectos, entregables, análisis, orquestador, sesiones, legacy, integración Ariadne). Constante **`MCP_THEFORGE_TOOLS_DOC_REVISION`**: incrementar al añadir o quitar tools en `index.ts`.
- **`src/index.ts`** — definición runtime (`TOOLS` con JSON Schema) y despacho (`handlers`).

Variables típicas: `THEFORGE_API_URL`, `MCP_M2M_SECRET`, `PORT` (modo HTTP).
