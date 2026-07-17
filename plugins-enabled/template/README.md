# Template — plugin de terceros

Copia esta carpeta a `plugins-enabled/mi-plugin/` y renombra el id reverse-DNS.

## Estructura mínima

```
mi-plugin/
  index.ts          # export { default } from "./plugin.js"
  mi-plugin.ts      # class implements ITheForgePlugin
  package.json      # opcional si el plugin tiene deps propias
  README.md
```

## Checklist

1. **`id` reverse-DNS** — p. ej. `com.empresa.mi-plugin` (único en el loader).
2. **`onPluginInit`** — validar licencia/config; no lanzar (el core hace skip del plugin).
3. **`getArtifactTypes()`** — declarar `id`, `label`, `generatable`, `requires`, `contentType`.
4. **`generateArtifact`** (opcional) — devolver `{ data, metadata }`; el core persiste en `project.pluginData[pluginId]`.
5. **Hooks** (opcional) — `beforeDocumentRender`, `afterDocumentRender`, `afterDocumentPersist`, `onProjectCreate`, `onProjectUpdate`.
6. **Probar sin plugin** — el core debe arrancar igual si la carpeta no existe o falla el import.

## Referencias

- Stub de desarrollo: `plugins-enabled/stub-plugin/`
- Contrato: `apps/api/src/plugins/interfaces/the-forge-plugin.interface.ts`
- Docs: `docs/PLUGINS.md`, `docs/ARCHITECTURE_PLUGINS.md`
- Health tras boot: `GET /plugins/health`

## contentType en artifacts

| Valor | Workshop |
|-------|----------|
| `json` (default) | Editor JSON |
| `markdown` | Preview MddViewer + fuente |
| `html` | Fuente HTML |

## Variables de entorno

- Directorios de plugins: configuración en `PluginLoaderService` (`PLUGINS_ENABLED_DIRS` / rutas por defecto).
