# Contributing to The Forge

Thanks for improving The Forge. This guide covers **licensing**, **documentation (JSDoc)**, **local development**, and **pull requests**.

## License and copyright

- Contributions are accepted under the **Apache License 2.0** ([`LICENSE`](LICENSE), [`NOTICE`](NOTICE)).
- Add yourself to [`AUTHORS.md`](AUTHORS.md) under **Contributors** when you contribute copyrightable work, unless you opt out.
- New files should carry the header described in [`docs/JSDOC.md`](docs/JSDOC.md).

## Architecture (short)

- **`apps/api`**: NestJS — auth (JWT/OTP), Prisma, AI (OpenRouter), engine (MDD semáforo, costes MXN), projects, sessions, legacy flows, MCP alignment.
- **`apps/web`**: React (Vite), Tailwind, Workshop UI, proxies to API.
- **`packages/database`**: Prisma schema and client.
- **`packages/shared-types`**, **`business-rules`**, **`config`**, **`mcp-server`**: shared contracts and tooling.

More detail: [`docs/notebooklm/THEFORGE-INDEX.md`](docs/notebooklm/THEFORGE-INDEX.md) and root [`README.md`](README.md).

## Local development

- Node ≥ 20, npm workspaces.
- `npm install`
- Database: configure `DATABASE_URL` (see `.env.example` at repo root), then:
  - `npm run db:generate`
  - `npm run db:push` (or migrations workflow you use)
- `npm run dev` (Turbo) or filtered dev for api/web only.

Docker: see [`README.md`](README.md) **Docker** section.

## JSDoc

- Follow [`docs/JSDOC.md`](docs/JSDOC.md).
- Prefer documenting **public** service methods, controllers, and exported helpers.
- Keep comments in **English** for code/JSDoc unless the file already uses Spanish consistently (then stay consistent within the file).

## Tests and lint

- `npm run lint` at root (Turbo).
- **`npm run test`** at root: smoke y unit tests en API, web (utilidades puras) y `business-rules`.
- **`npm run test:types`**: `tsc --noEmit` en API y web (detecta imports rotos y tipos antes de desplegar).
- API: `cd apps/api && npm test` — incluye `src/smoke/cross-module-imports.smoke.spec.ts` (imports entre módulos Nest).
- Web: `cd apps/web && npm test` — utilidades NDJSON, errores HTTP, markdown, design tokens.
- MCP alignment (API): `npm run test:mcp-alignment` en `apps/api`.

## Pull requests

- Small, focused PRs with a clear description and test steps.
- Mention **breaking** API or schema changes prominently.
- Do not commit secrets; use env files and deployment configuration only.

## Security

Contact the maintainers (see [`AUTHORS.md`](AUTHORS.md)) for responsible disclosure before public exploitation details.
