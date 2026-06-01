# Plugins de fuente de componentes

Guía para **autores de plugins** y para integrar una nueva fuente de componentes (design system MCP) en TheForge.

El contrato NPM vive en el repo externo [`theforge-component-source`](https://github.com/kreodevs/theforge-component-source). Este documento cubre el **pegamento en el producto**: registry Nest, UI, BD y workshop.

---

## Visión

| Pieza | Rol |
|-------|-----|
| `ComponentSourcePort` | Interfaz única: catálogo, resolución, previews, salud |
| `ComponentSourceRegistry` | Mapa de plugins registrados; resuelve **un plugin activo** por usuario |
| `NullComponentSource` | Degradación segura cuando la fuente está off o mal configurada |
| BD `User` | `componentSourceEnabled`, `componentSourcePluginId`, URL y token cifrado |

Reglas:

- Varios plugins **registrados en código**; **uno activo** por usuario (`pluginId` + credenciales).
- Si `enabled === false` o falta config → `NullComponentSource` (catálogos vacíos); wireframes **no se rompen**.
- **Sin validación en bootstrap**: el módulo Nest solo registra factories; las credenciales se validan al guardar/probar en UI o en la primera llamada runtime.

---

## Repos

```
Documents/GitHub/
├── theforge/                      ← monorepo producto (Nest, React, Prisma)
│   └── apps/api/src/modules/component-source/
└── theforge-component-source/     ← paquetes NPM (@theforge/component-source, …-orbita)
```

| Repo | Contiene |
|------|----------|
| `theforge-component-source` | Tipos, puerto, `NullComponentSource`, adaptadores MCP (Orbita, futuros) |
| `theforge` | Registry Nest, credential service, UI Ajustes, persistencia BD, call-sites wireframes |

---

## Crear un plugin nuevo

### 1. Paquete en el repo externo

Crear `packages/component-source-<nombre>/` con:

```typescript
import type { ComponentSourcePlugin, ComponentSourcePort } from "@theforge/component-source";

export function createMyPlugin(
  resolver: () => Promise<{ url: string; token?: string } | null>,
): ComponentSourcePlugin {
  return {
    meta: {
      id: "my-plugin",
      label: "Mi Design System MCP",
      description: "Catálogo vía MCP Streamable HTTP",
      // authFields opcional en meta futuro; Orbita usa url + token
    },
    create: () => new MyComponentSource(resolver),
  };
}
```

Implementar `ComponentSourcePort` (métodos usados por wireframes/previews: `listModules`, `resolveComponents`, `catalogHealth`, `getComponentPreviews`, `getDesignSystem`, `checkHealth`, etc.).

| Método port | Tool MCP (Orbita) | Uso en The Forge |
|-------------|-------------------|------------------|
| `getDesignSystem(userId, { format?, theme?, includeMarkdown? })` | `get_design_system` | Contexto de tokens para wireframes y bocetos (`format: "context"`) |

**No incluir Prisma ni Nest** en el paquete NPM: el resolver de credenciales lo inyecta TheForge.

### 2. Resolver de credenciales

En Nest, `ComponentSourceCredentialService` lee BD + `TokenCryptoService` y expone resolvers tipados (ver Orbita como referencia).

### 3. Build local

```bash
cd ../theforge-component-source
pnpm install && pnpm build
cd ../theforge
pnpm install   # resuelve file: hacia dist/
```

---

## Registrar en The Forge

Editar [`apps/api/src/modules/component-source/component-source.plugins.ts`](../apps/api/src/modules/component-source/component-source.plugins.ts):

```typescript
import { createOrbitaPlugin } from "@theforge/component-source-orbita";
import { createMyPlugin } from "@theforge/component-source-my";

export function buildComponentSourcePlugins(deps: ComponentSourcePluginsDeps): ComponentSourcePlugin[] {
  return [
    createOrbitaPlugin(deps.credentialService.createOrbitaResolver()),
    createMyPlugin(deps.credentialService.createMyResolver()),
  ];
}
```

Añadir dependencia en [`apps/api/package.json`](../apps/api/package.json):

```json
"@theforge/component-source-my": "file:../../../theforge-component-source/packages/component-source-my"
```

Tras publish NPM, sustituir `file:` por semver (`^0.1.0`).

El plugin aparecerá en **Ajustes → Fuente de componentes** vía `GET /auth/component-source/config` → `plugins[]`.

---

## Configuración de usuario

| Campo BD | API config |
|----------|------------|
| `componentSourceEnabled` | `enabled` |
| `componentSourcePluginId` | `pluginId` |
| `componentSourceUrl` | `url` |
| `componentSourceTokenCipher` | `hasToken` (nunca el valor) |

- **PUT** `/auth/component-source/config` — parcial; devuelve el mismo shape que GET.
- Token cifrado con `TokenCryptoService` solo si el body incluye `token`.
- `enabled: false` **no borra** credenciales (reactivar sin reintroducir token).
- **POST** `/admin/component-source/test` — prueba borrador (`url`/`token` del formulario) o guardado (`useSaved: true`).

UI: [`ComponentSourceConfigCard.tsx`](../apps/web/src/components/ComponentSourceConfigCard.tsx).

---

## Bootstrap (prohibiciones)

En `ComponentSourceModule` / `ComponentSourceRegistry`:

- ✅ Registrar plugins en constructor (`registerPlugins`).
- ❌ Health check MCP en `onModuleInit`.
- ❌ `fetch` / `initialize` al arrancar la API.

La validación ocurre en UI (probar conexión) o en runtime (`resolveForUser` → primera tool call).

---

## Pruebas locales

1. Terminal A: `pnpm dev` en `theforge-component-source` (watch `dist/`).
2. Terminal B: `pnpm dev:api` en `theforge`.
3. Checklist:
   - Toggle **off** → wireframes generan sin MCP; workshop oculta previews de componentes.
   - Toggle **on** + Orbita → mapper resuelve componentes; preview-snippets devuelve `componentSourceActive: true`.
   - Probar conexión con borrador **sin guardar**.
   - Token guardado → recargar → `hasToken: true`, placeholder `••••`.

### Diagnóstico MCP (dev)

Para inspeccionar shapes reales del plugin activo (`list_modules`, `resolve_components`, `catalog_health.preview`, `get_component_previews`, `get_design_system`):

**Script CLI** (usuario con fuente activa en BD):

```bash
pnpm exec tsx apps/api/scripts/diagnose-component-source.ts [userId-opcional]
```

**Endpoint** (solo `NODE_ENV !== production`, sesión autenticada):

```http
POST /admin/component-source/diagnose
```

La respuesta JSON incluye tamaños de catálogo, muestras de resolución, capacidades de preview, kinds del batch de preview y métricas de design system (`tokenKeyCount`, `hasDesignMd`, `cssVarCount`, `meta.version`).

Cuando la fuente de componentes está activa, el pipeline de wireframes y bocetos llama `getDesignSystem({ format: "context" })` y fusiona el resultado con la guía UX/UI del proyecto (Orbita como SSOT de tokens; la guía complementa huecos). Si la tool falla o no existe, se usa solo la guía UX/UI.

---

## Publicar (NPM)

1. Validar con enlace `file:` en dev.
2. En repo externo: `private: false`, semver, `pnpm publish` (scope `@theforge`).
3. En The Forge: reemplazar `file:` por versión publicada en `apps/api/package.json`.
4. Tag Git en repo externo por release.

---

## Frontera con Ariadne

| Tema | Fuente de componentes | Ariadne |
|------|----------------------|---------|
| Propósito | Catálogo UI / previews wireframes | Base de conocimiento / análisis código |
| Campos BD | `componentSource*` | `ariadneMcpUrl`, `ariadneMcpToken` |
| Módulos Nest | `component-source/*` | `theforge/*`, legacy-flow |
| Test admin | `/admin/component-source/test` | `/admin/ariadne-config/test` |
| Paquete MCP HTTP util | Adaptador plugin | `mcp-http.util.ts` (no mover) |

No reutilizar credenciales Ariadne para component source ni viceversa.

---

## Ejemplo de referencia: Orbita

| Artefacto | Ubicación |
|-----------|-----------|
| Adaptador MCP | `@theforge/component-source-orbita` → `OrbitaComponentSource` |
| Factory | `createOrbitaPlugin(resolver)` |
| Registro Nest | `component-source.plugins.ts` → `createOrbitaPlugin(...)` |
| Plugin id | `"orbita"` |
| Credenciales | URL MCP + Bearer token |
| Health | `GET …/health` + tool `catalog_health` |

Ver implementación en el repo externo y [`component-source-credential.service.ts`](../apps/api/src/modules/component-source/component-source-credential.service.ts).

---

## Documentación relacionada

- Repo externo: README y API de `@theforge/component-source`
- Integración Ariadne (patrón similar): [notebooklm/integracion-theforge/README.md](./notebooklm/integracion-theforge/README.md)
- Módulo Nest (puntero): [apps/api/src/modules/component-source/README.md](../apps/api/src/modules/component-source/README.md)
