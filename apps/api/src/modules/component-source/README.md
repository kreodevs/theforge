# Component Source (Nest)

Registry y credenciales de **fuentes de componentes** multi-plugin para wireframes y previews MCP.

## Documentación canónica

Guía completa para crear y registrar plugins: **[docs/component-source-plugins.md](../../../../../docs/component-source-plugins.md)**.

## Arquitectura mínima

```
component-source.plugins.ts   ← registro explícito de plugins NPM
        ↓
ComponentSourceRegistry     ← listPlugins(), resolveForUser() → ComponentSourcePort
        ↓
ComponentSourceCredentialService  ← Prisma + TokenCrypto → resolvers por plugin
```

## Registrar un plugin

Editar `component-source.plugins.ts`:

```typescript
export function buildComponentSourcePlugins(deps: ComponentSourcePluginsDeps): ComponentSourcePlugin[] {
  return Object.values(PLUGIN_FACTORIES).map((factory) =>
    factory(deps.credentialService.createUrlTokenResolver()),
  );
}
```

**Bootstrap:** solo registro en Map — sin HTTP ni validación de credenciales al arrancar.

## API relacionada

| Ruta | Uso |
|------|-----|
| `GET/PUT /auth/component-source/config` | Config usuario + metadatos `plugins[]` |
| `POST /admin/component-source/test` | Probar conexión (borrador o guardado) |

## Paquetes NPM

Desarrollo local vía `file:` en `apps/api/package.json` hacia [`theforge-component-source`](https://github.com/kreodevs/theforge-component-source).
