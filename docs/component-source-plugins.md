# Plugins de fuente de componentes

Guía para **autores de plugins** y para integrar una nueva fuente de componentes (design system MCP) en TheForge.

El contrato vive en `packages/component-source/` del monorepo. Este documento cubre el **pegamento en el producto**: registry Nest, perfiles, UI, BD y workshop.

---

## Visión

| Pieza | Rol |
|-------|-----|
| `ComponentSourcePort` | Interfaz única: catálogo, resolución, previews, salud |
| `ComponentSourceRegistry` | Mapa de plugins registrados; resuelve **por proyecto** vía perfil asignado |
| `ComponentSourceProfile` | Credenciales MCP reutilizables por usuario (URL, token cifrado, mapeo de tools) |
| `Project.componentSourceProfileId` | Perfil activo en un proyecto del taller |
| `NullComponentSource` | Degradación segura cuando no hay perfil o el mapeo no está confirmado |

Reglas:

- Varios plugins **registrados en código**; cada **perfil** elige `pluginId` + credenciales.
- Cada **proyecto** referencia **un perfil** del owner (`componentSourceProfileId`).
- Sin perfil asignado o sin mapeo confirmado → `NullComponentSource` (catálogos vacíos); wireframes **no se rompen**.
- **Sin validación en bootstrap**: el módulo Nest solo registra factories; las credenciales se validan al probar/confirmar mapeo en UI o en la primera llamada runtime.

### Campos legacy en `User`

La migración `20260603120000_component_source_profiles` copia config antigua a un perfil **«Perfil migrado»**. Los campos `User.componentSource*` permanecen en BD (solo lectura histórica); **no** se escriben desde la API. Usar perfiles + asignación por proyecto.

---

## Paquetes en el monorepo

```
theforge/
├── packages/component-source/          ← @theforge/component-source (contrato)
├── packages/component-source-mcp/      ← @theforge/component-source-mcp (cliente MCP genérico)
└── apps/api/src/modules/component-source/
```

| Paquete | Contiene |
|---------|----------|
| `@theforge/component-source` | Tipos, puerto, `NullComponentSource`, `parseMcpResponse` |
| `@theforge/component-source-mcp` | Cliente MCP Streamable HTTP; **no** acoplado al código de Orbita |
| `apps/api/.../component-source` | Registry Nest, perfiles, credential service, persistencia BD |

Orbita (u otro servidor) solo necesita exponer el MCP con las tools del catálogo; **no** hace falta código adicional en el repo de Orbita para consumir este paquete.

---

## Crear un plugin nuevo

### 1. Paquete bajo `packages/`

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
    },
    create: () => new MyComponentSource(resolver),
  };
}
```

Implementar `ComponentSourcePort` (métodos usados por wireframes/previews: `listModules`, `resolveComponents`, `catalogHealth`, `getComponentPreviews`, `getDesignSystem`, `checkHealth`, etc.).

| Método port | Tool MCP | Uso en The Forge |
|-------------|----------|------------------|
| `getDesignSystem(userId, { format?, theme?, includeMarkdown? })` | `get_design_system` | Contexto de tokens para wireframes y bocetos (`format: "context"`) |

**No incluir Prisma ni Nest** en el paquete NPM: el resolver de credenciales lo inyecta TheForge por perfil.

### 2. Resolver de credenciales

En Nest, `ComponentSourceCredentialService` lee filas `ComponentSourceProfile` + `TokenCryptoService` y expone `createProfileResolver(profileId)`.

### 3. Build

```bash
pnpm --filter @theforge/component-source build
pnpm --filter @theforge/component-source-mcp build
```

---

## Registrar en The Forge

Editar [`apps/api/src/modules/component-source/component-source.plugins.ts`](../apps/api/src/modules/component-source/component-source.plugins.ts):

```typescript
import { createMcpPlugin } from "@theforge/component-source-mcp";
import { createMyPlugin } from "@theforge/component-source-my";

const PLUGIN_FACTORIES: Record<string, PluginFactory> = {
  mcp: (resolver) => createMcpPlugin(resolver),
  "my-plugin": (resolver) => createMyPlugin(resolver),
};
```

Añadir dependencia en [`apps/api/package.json`](../apps/api/package.json):

```json
"@theforge/component-source-my": "workspace:*"
```

Metadatos de plugins disponibles en **`GET /component-source/plugins`**.

**Compatibilidad:** `pluginId: "orbita"` en perfiles se normaliza a `mcp` (mismo adaptador genérico). Ver `LEGACY_PLUGIN_IDS` en `component-source.plugins.ts`.

---

## Configuración (perfiles + proyecto)

| Recurso | API |
|---------|-----|
| CRUD perfiles del usuario | `GET/POST/PATCH/PUT/DELETE /auth/component-source/profiles` |
| Probar conexión / proponer mapeo | `POST /auth/component-source/profiles/:id/test` |
| Confirmar mapeo de tools | `POST /auth/component-source/profiles/:id/confirm-mapping` |
| Asignar perfil al proyecto | `GET/PUT /component-source/projects/:projectId/profile` |
| Importar design system completo | `POST /auth/component-source/projects/:projectId/design-system` |
| Probar conexión (admin) | `POST /admin/component-source/test` (`profileId` + borrador opcional) |

Flujo UI:

1. **Ajustes → Fuente de componentes**: crear perfil MCP, probar, confirmar mapeo.
2. **Taller → proyecto**: selector de perfil (`ProjectComponentSourceProfileSelector`).
3. Wireframes y previews usan `ComponentSourceRegistry.resolveForProject(projectId)`.

Token cifrado con `TokenCryptoService` al crear/actualizar perfil. **No** se reenvía el valor en GET; solo `hasToken`.

UI: [`ComponentSourceConfigCard.tsx`](../apps/web/src/components/ComponentSourceConfigCard.tsx), [`ComponentSourceProfileModal.tsx`](../apps/web/src/components/ComponentSourceProfileModal.tsx).

---

## Bootstrap (prohibiciones)

En `ComponentSourceModule` / `ComponentSourceRegistry`:

- ✅ Registrar plugins en constructor (`registerPlugins`).
- ❌ Health check MCP en `onModuleInit`.
- ❌ `fetch` / `initialize` al arrancar la API.

La validación ocurre en UI (probar conexión, confirmar mapeo) o en runtime (`resolveForProject` → primera tool call).

---

## Pruebas locales

1. `pnpm --filter @theforge/component-source dev` (watch) en una terminal.
2. `pnpm dev:api` en otra.
3. Checklist:
   - Proyecto **sin perfil** → wireframes generan sin MCP; workshop oculta previews de componentes.
   - Perfil asignado + mapeo confirmado → mapper resuelve componentes; preview-snippets devuelve `componentSourceActive: true`.
   - Probar conexión con borrador **sin guardar**.
   - Token guardado → recargar → `hasToken: true`, placeholder `••••`.

### Diagnóstico MCP (dev)

```bash
pnpm exec tsx apps/api/scripts/diagnose-component-source.ts [projectId-opcional]
```

**Endpoint** (solo `NODE_ENV !== production`, sesión autenticada):

```http
POST /admin/component-source/diagnose
Content-Type: application/json

{ "projectId": "<uuid>" }
```

Cuando la fuente de componentes está activa en el proyecto, el pipeline de wireframes llama `getDesignSystem({ format: "context" })` y fusiona el resultado con la guía UX/UI del proyecto. Si la tool falla, se usa solo la guía UX/UI.

---

## Plugin MCP integrado (referencia)

| Artefacto | Ubicación |
|-----------|-----------|
| Adaptador MCP | `@theforge/component-source-mcp` → `MappedMcpComponentSource` |
| Factory | `createMcpPlugin(resolver)` |
| Registro Nest | `component-source.plugins.ts` → clave `"mcp"` |
| Plugin id canónico | `"mcp"` (alias BD/perfil: `"orbita"`) |
| Credenciales | URL MCP + Bearer token opcional (por perfil) |
| Health | `GET …/health` + tool `catalog_health` |

---

## Frontera con Ariadne

| Tema | Fuente de componentes | Ariadne |
|------|----------------------|---------|
| Propósito | Catálogo UI / previews wireframes | Base de conocimiento / análisis código |
| Campos BD | `ComponentSourceProfile`, `Project.componentSourceProfileId` | `ariadneMcpUrl`, `ariadneMcpToken` |
| Módulos Nest | `component-source/*` | `theforge/*`, legacy-flow |
| Test admin | `/admin/component-source/test` | `/admin/ariadne-config/test` |

No reutilizar credenciales Ariadne para component source ni viceversa.

---

## Documentación relacionada

- `packages/component-source/README.md`
- `packages/component-source-mcp/README.md`
- Módulo Nest: [apps/api/src/modules/component-source/README.md](../apps/api/src/modules/component-source/README.md)
