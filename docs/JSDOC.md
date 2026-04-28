# JSDoc y documentación en código (The Forge)

Define cómo documentamos el monorepo **The Forge** (Turborepo: API NestJS, Web Vite/React, paquetes compartidos) para colaboradores y para generación futura de documentación.

## Licencia y copyright

- **Apache License 2.0**: [`LICENSE`](../LICENSE), [`NOTICE`](../NOTICE), [`AUTHORS.md`](../AUTHORS.md).
- En **archivos nuevos** o al ampliar módulos, incluye:

```ts
/**
 * @fileoverview Rol del archivo en el monorepo (API, web, paquete).
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
```

## Convenciones JSDoc (TypeScript)

| Etiqueta | Uso |
|----------|-----|
| `@fileoverview` | Propósito del archivo y capa (Nest module, React view, utilidad pura). |
| `@param` | Argumentos de funciones exportadas y métodos públicos de servicios. |
| `@returns` | Valor o `Promise<…>`; en controladores Nest, el DTO o forma JSON relevante. |
| `@throws` | `HttpException`, validación Zod, errores de dominio. |
| `@see` | `docs/notebooklm/`, `blueprint.md`, `mdd.md`, otros módulos. |

### NestJS (`apps/api`)

- **Módulos**: qué bounded context agrupan (auth, engine, projects, sessions, AI, legacy-flow, etc.).
- **Guards / interceptors**: orden global (`APP_GUARD`) y efectos en el request (JWT, contexto de usuario).

### React (`apps/web`)

- **Vistas** (`views/`): flujo de usuario (Workshop, login, proyectos) y dependencias de API.
- **Componentes** compartidos: props obligatorias y accesibilidad cuando no sea obvio.

### Paquetes (`packages/*`)

- **`@theforge/database`**: no documentes cada modelo Prisma a mano en JSDoc salvo lógica custom; el schema Prisma es la referencia.
- **`shared-types`**, **`business-rules`**, **`config`**: documenta exports públicos y contratos estables.
- **`@theforge/mcp-server`**: catálogo JSDoc de las 43 herramientas en [`packages/mcp-server/src/mcp-tools.doc.ts`](../packages/mcp-server/src/mcp-tools.doc.ts) (`MCP_THEFORGE_TOOLS_DOC_REVISION`); implementación en [`packages/mcp-server/src/index.ts`](../packages/mcp-server/src/index.ts) (`TOOLS` + `handlers`).

## Entry points (mantener cabeceras)

| Ruta | Rol |
|------|-----|
| `apps/api/src/main.ts` | Bootstrap API: env, CORS, body size, puerto. |
| `apps/api/src/app.module.ts` | Grafo de módulos Nest. |
| `apps/web/src/main.tsx` | Montaje React. |
| `packages/mcp-server/src/mcp-tools.doc.ts` | JSDoc del catálogo MCP → API The Forge. |
| `packages/mcp-server/src/index.ts` | Servidor MCP (stdio / HTTP `--http`). |

## Documentación narrativa

- Índice: [`docs/notebooklm/THEFORGE-INDEX.md`](notebooklm/THEFORGE-INDEX.md).
- Producto: [`blueprint.md`](../blueprint.md), [`mdd.md`](../mdd.md), [`README.md`](../README.md).

## TypeDoc / sitio de API (opcional)

Si se añade generador, documentar el comando aquí. Hoy la referencia principal es código + Markdown del repo.
