# docs_mcp/

Structured documentation corpus served to AI agents by **`@theforge/docs-mcp-server`**
(see `packages/docs-mcp-server/`). Each Markdown file is an *atomic* page that follows
[`DOCUMENTATION_TEMPLATE.md`](./DOCUMENTATION_TEMPLATE.md).

## How it maps to MCP

| On disk                              | MCP exposure                          |
| ------------------------------------ | ------------------------------------- |
| `docs_mcp/<section>/<file>.md`       | Resource `docs://<section>/<id>`      |
| frontmatter `id`                     | `<topic>` segment of the URI          |
| the whole tree                       | Resource `docs://manifest` (JSON)     |
| `AI Context Brief` blockquote        | `summary` in the manifest + search    |

- The **first-level folder** is the URI `section` (`componentes/`, `arquitectura/`, `guias/`).
- The frontmatter **`id`** is the URI `topic` (falls back to the file name).
- `DOCUMENTATION_TEMPLATE.md` and any `README.md` are **excluded** from the manifest and search.

## Authoring rules

1. One page = one atomic component / module / concept. Do not mix topics.
2. Keep the standard section titles so `get_component_api` can extract the contract:
   *Uso Básico / Quick Start*, *API & Contrato de Tipos / Props / Specs*, *Decisiones de Diseño / Restricciones*.
3. Write the `AI Context Brief` as a single sentence: what it is + when the agent should use it.
4. Code, comments and docs in English/Spanish per project convention; keep examples copy-pasteable.

## Current sections

- `componentes/` — UI/design-system components (`button`, `badge`, `card`, `input`, `dialog`, `empty-state`).
- `arquitectura/` — platform architecture (`monorepo-overview`, `docs-mcp-server`, `data-layer`, `estado-workshop-store`, `mdd-semaforo`, `agentes-ia-langgraph`, `integracion-new-legacy`).
- `guias/` — how-to guides (`consumir-docs-mcp`).

Add files freely; the server picks them up automatically (mtime-based reload).
