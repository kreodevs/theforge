# @theforge/docs-mcp-server

MCP server (official `@modelcontextprotocol/sdk`) that serves the project's
structured documentation corpus (`docs_mcp/`) to AI agents, following an atomic,
context-efficient design (Astryx-style): the agent discovers via a manifest and reads
only the pages it needs.

## What it exposes

### Resources

| URI                          | MIME               | Description                                          |
| ---------------------------- | ------------------ | ---------------------------------------------------- |
| `docs://manifest`            | `application/json` | Full index/hierarchy: sections, topics, summaries.   |
| `docs://<section>/<topic>`   | `text/markdown`    | One documentation page as clean Markdown.            |

### Tools

| Tool                          | Input                                 | Returns                                              |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `search_docs`                 | `query: string`, `limit?: number`     | Ranked fragments (title, URI, section, snippet).     |
| `get_component_api`           | `componentName: string`               | Only Usage + Props/Types + Design rules of a page.   |

## Run

```bash
pnpm --filter @theforge/docs-mcp-server build

# stdio (default) — for Cursor / local agents:
node packages/docs-mcp-server/dist/index.js

# Streamable HTTP — deployable:
node packages/docs-mcp-server/dist/index.js --http --port 8081
# GET /health for a readiness probe.
```

### Docs folder resolution

1. `--docs <dir>` CLI flag
2. `DOCS_MCP_DIR` env var
3. nearest `docs_mcp/` folder walking up from CWD, then from the built module.

## Cursor `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "theforge-docs": {
      "command": "node",
      "args": ["packages/docs-mcp-server/dist/index.js"],
      "env": { "DOCS_MCP_DIR": "${workspaceFolder}/docs_mcp" }
    }
  }
}
```

## Smoke test

```bash
pnpm --filter @theforge/docs-mcp-server build
node packages/docs-mcp-server/scripts/smoke.mjs
```

Spawns the built server over stdio with the MCP SDK client and exercises the manifest,
a page read, `search_docs` and `get_component_api`.

## Notes

- The `src/` is intentionally framework-free and free of workspace dependencies so the
  exact same code is mirrored in Ariadne (`services/mcp-docs`).
- In stdio mode, **stdout is the JSON-RPC channel** — all logs go to stderr.
- `DOCUMENTATION_TEMPLATE.md` and `README.md` files are excluded from the corpus.
