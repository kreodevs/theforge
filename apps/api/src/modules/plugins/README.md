# Módulo HTTP de plugins

Expone el contrato runtime entre el core y plugins cargados dinámicamente.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/plugins/artifacts` | Artifact types para sidebar del Workshop |
| GET | `/plugins/settings-panels` | Paneles de Ajustes declarados por plugins |
| GET | `/plugins/user-settings` | Mapa de ajustes del usuario autenticado |
| GET | `/plugins/:pluginId/user-settings` | Ajustes de un plugin |
| PUT | `/plugins/:pluginId/user-settings` | Guardar ajustes (validación opcional del plugin) |
| GET | `/plugins/projects/:id/plugin-data/:pluginId` | Datos del plugin por proyecto |
| PUT | `/plugins/projects/:id/plugin-data/:pluginId` | Persistir datos del plugin |

## Servicios relacionados

- `PluginLoaderService` — carga dinámica e hooks
- `PluginUserSettingsService` — persistencia en `UserAISettings.pluginUserSettings`

Ver `docs/PLUGINS.md` §5.7 y `docs/ARCHITECTURE_PLUGINS.md`.
