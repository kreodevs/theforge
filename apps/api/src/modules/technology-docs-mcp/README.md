# `technology-docs-mcp` — Technology Docs MCP (Context7-compatible)

Optional MCP integration to **enrich SDD deliverables** with up-to-date library documentation (NestJS, Prisma, React, etc.). Does **not** replace Ariadne (codebase graph) or UI MCP (components).

## Configuration

| Env | Role |
|-----|------|
| `TECH_DOCS_MCP_URL` | Streamable HTTP MCP endpoint (Context7 or compatible). **Empty = skip** (no impact on pipeline). |
| `TECH_DOCS_MCP_TOKEN` | Optional auth token (`X-M2M-Token` / Bearer). |
| `TECH_DOCS_MCP_TIMEOUT_MS` | Per-call timeout (default `15000`). |
| `TECH_DOCS_MCP_MAX_LIBRARIES` | Max libraries resolved per generation (default `3`, cap `6`). |

## Tools expected (Context7)

- `resolve-library-id` — `{ libraryName, query }`
- `query-docs` — `{ libraryId, query }`

## Consumption

`TechnologyDocsMcpClientService.buildContextForMdd(mdd, blueprint?)` is invoked from `AiService` when generating:

- Architecture
- API contracts
- Tasks

Graceful degradation: unset URL, MCP errors, or unknown libraries → generators run unchanged.

## Stack detection

`@theforge/shared-types/technology-docs` — `resolveStackLibrariesFromMarkdown()` scans MDD §2 / blueprint for known stack tokens.
