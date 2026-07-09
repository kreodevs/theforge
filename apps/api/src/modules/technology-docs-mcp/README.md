# `technology-docs-mcp` — Technology Docs MCP (Context7-compatible)

Optional MCP integration to **enrich SDD deliverables** with up-to-date library documentation (NestJS, Prisma, React, etc.). Does **not** replace Ariadne (codebase graph) or UI MCP (components).

## User configuration (Ajustes)

Each user configures their own Context7 credentials (same pattern as Ariadne):

| Field | Prisma | UI |
|-------|--------|-----|
| MCP URL | `User.techDocsMcpUrl` | Ajustes → **Docs técnicas** |
| API key | `User.techDocsMcpToken` | Header `CONTEXT7_API_KEY` |

REST: `GET/PUT /api/auth/tech-docs-config`, test: `POST /api/admin/tech-docs-config/test`.

Default URL when empty: `https://mcp.context7.com/mcp`.

Context7 uses **Streamable HTTP with MCP session** (`initialize` → `notifications/initialized` → `tools/*` with `Mcp-Session-Id`). Auth is only via header `CONTEXT7_API_KEY` (not Bearer/X-M2M-Token).

## Platform env (optional)

| Env | Role |
|-----|------|
| `TECH_DOCS_MCP_DEFAULT_URL` | Override default MCP URL for all users |
| `TECH_DOCS_MCP_TIMEOUT_MS` | Per-call timeout (default `15000`) |
| `TECH_DOCS_MCP_MAX_LIBRARIES` | Max libraries per generation (default `3`) |

No platform-wide API key — skip when user has not configured theirs.

## Tools expected (Context7)

- `resolve-library-id` — `{ libraryName, query }`
- `query-docs` — `{ libraryId, query }`

## Consumption

`TechnologyDocsMcpClientService.buildContextForMdd()` from `AiService` when generating Architecture, API contracts, and Tasks.

## Stack detection

`@theforge/shared-types/technology-docs` — `resolveStackLibrariesFromMarkdown()`.
