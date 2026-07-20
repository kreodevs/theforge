# plugins-enabled

Directorios de plugins cargados en runtime por `PluginLoaderService`.

| Plugin | Id | Propósito |
|--------|-----|-----------|
| `stub-plugin/` | `dev.theforge.stub-plugin` | Valida motor genérico (hooks + `generateArtifact`) en dev/CI |
| `template/` | — | Guía para crear plugins de terceros (solo README) |

## Producción (Dokploy)

- Volumen Docker: `theforge_plugins` → `/app/plugins-enabled` (API + worker).
- Instalar desde **Ajustes → Plugins** subiendo un `.tfplugin` o con clave de licencia.
- Empaquetar: `docs/PLUGINS-PACKAGING.md` y `pnpm exec tsx scripts/pack-theforge-plugin.ts`.

Ver `docs/PLUGINS.md`.
