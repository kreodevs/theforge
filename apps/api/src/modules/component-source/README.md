# Component Source (Nest)

Registry y credenciales de **fuentes de componentes** multi-plugin para wireframes y previews MCP.

## Documentación canónica

Guía completa para crear y registrar plugins: **[docs/component-source-plugins.md](../../../../../docs/component-source-plugins.md)**.

## Arquitectura mínima

```
component-source.plugins.ts   ← registro explícito de plugins NPM
        ↓
ComponentSourceRegistry     ← listPlugins(), resolveForProject() → ProjectComponentSourceContext
        ↓
ComponentSourceCredentialService  ← Prisma + TokenCrypto → resolvers por perfil
        ↓
ComponentSourceProfileService     ← CRUD perfiles, asignación por proyecto
```

## Registrar un plugin

Editar `component-source.plugins.ts`:

```typescript
export function buildComponentSourcePlugins(): ComponentSourcePlugin[] {
  return Object.values(PLUGIN_FACTORIES).map((factory) => factory(REGISTER_STUB_RESOLVER));
}
```

En runtime, `createPluginInstance(pluginId, profileResolver, toolMapping)` construye el port con credenciales del perfil.

**Bootstrap:** solo registro en Map — sin HTTP ni validación de credenciales al arrancar.

## API relacionada

| Ruta | Uso |
|------|-----|
| `GET/POST/PATCH/PUT/DELETE /auth/component-source/profiles` | CRUD perfiles MCP (rutas esperadas por el frontend) |
| `POST /auth/component-source/profiles/:id/test` | Prueba dual: health-only o propuesta de mapeo |
| `POST /auth/component-source/profiles/:id/confirm-mapping` | Persiste toolMapping + capabilities + hash |
| `POST /auth/component-source/projects/:projectId/design-system` | Importar design system completo desde el perfil del proyecto |
| `GET /auth/component-source/regeneration/events` | NDJSON progreso al cambiar perfil de proyecto |
| `GET/PUT /component-source/projects/:projectId/profile` | Asignación de perfil por proyecto (owner) |
| `GET /component-source/plugins` | Metadatos de plugins registrados |
| `POST /admin/component-source/test` | Probar conexión (borrador o perfil guardado) |
| `POST /admin/component-source/diagnose` | Diagnóstico dev (`{ projectId }`) |

## Legacy eliminado (Phase 3)

- `GET/PUT /auth/component-source/config` y alias `/auth/component-mcp-config` — sustituidos por perfiles.
- `POST /auth/component-source/design-system` (nivel usuario) — sustituido por ruta con `projectId`.
- `ComponentSourceRegistry.resolveForUser()` — sustituido por `resolveForProject()`.
- Escritura a `User.componentSource*` — detenida; columnas conservadas en BD (migración histórica).

## Paquetes NPM

Los paquetes viven en el monorepo:

- `packages/component-source` — contrato `@theforge/component-source`
- `packages/component-source-mcp` — cliente MCP genérico `@theforge/component-source-mcp`

Dependencias en `apps/api/package.json` con `workspace:*`.
