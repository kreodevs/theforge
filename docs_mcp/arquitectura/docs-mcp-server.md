---
id: docs-mcp-server
title: Docs MCP Server
category: Arquitectura
last_updated: 2026-06-29
---

# Docs MCP Server (`@theforge/docs-mcp-server`)

> **AI Context Brief:** Servidor MCP (SDK oficial) que sirve esta carpeta `docs_mcp/` a agentes de IA como recursos `docs://…` y herramientas `search_docs` / `get_component_api`; léelo cuando necesites entender cómo se expone o despliega la documentación.

## 1. Uso Básico (Quick Start)

```typescript
// Ejecutar en local (stdio, ideal para Cursor):
//   pnpm --filter @theforge/docs-mcp-server build
//   node packages/docs-mcp-server/dist/index.js
//
// Modo HTTP (Streamable, contenedorizable):
//   node packages/docs-mcp-server/dist/index.js --http --port 8081
//
// Resolución de la carpeta de docs (en orden):
//   1. --docs <dir>
//   2. DOCS_MCP_DIR
//   3. docs_mcp/ más cercano hacia arriba desde el CWD / el módulo

// Entrada en .cursor/mcp.json:
const mcpJson = {
  mcpServers: {
    "theforge-docs": {
      command: "node",
      args: ["packages/docs-mcp-server/dist/index.js"],
      env: { DOCS_MCP_DIR: "${workspaceFolder}/docs_mcp" },
    },
  },
};
```

## 2. API & Contrato de Tipos (Specs)

### Recursos (Resources)

| URI                          | Tipo MIME          | Descripción                                                        |
| ---------------------------- | ------------------ | ------------------------------------------------------------------ |
| `docs://manifest`            | `application/json` | Índice/jerarquía completa: secciones, topics, `summary`, URIs.     |
| `docs://<section>/<topic>`   | `text/markdown`    | Página individual en Markdown limpio (sin frontmatter).            |

### Herramientas (Tools)

| Tool                              | Input                                  | Devuelve                                                            |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `search_docs`                     | `query: string`, `limit?: number` (6)  | Fragmentos rankeados (título, URI, sección, snippet).              |
| `get_component_api`               | `componentName: string`                | Solo `Uso Básico` + `API & Contrato de Tipos` + `Decisiones`.     |

### Variables de entorno

| Variable         | Por Defecto | Descripción                                              |
| ---------------- | ----------- | -------------------------------------------------------- |
| `DOCS_MCP_DIR`   | autodetect  | Carpeta raíz de la documentación.                        |
| `PORT`           | `8081`      | Puerto en modo `--http`.                                 |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** El `src/` es idéntico al de la versión de Ariadne (`services/mcp-docs`); no introduzcas dependencias de workspace para que ambos repos compartan el mismo código.
- **Regla 2:** En modo stdio, **stdout es el canal JSON-RPC**: todo log va a `stderr` (`console.error`). No imprimas a stdout.
- **Regla 3:** El `manifest` y las páginas se recargan solas al cambiar archivos (mtime); editar docs no requiere reiniciar el servidor.
- **Regla 4:** `DOCUMENTATION_TEMPLATE.md` y `README.md` se excluyen del manifest y de la búsqueda.
- **Regla 5:** Una página por concepto atómico; respeta los títulos de sección para que `get_component_api` extraiga el contrato correcto.
