# Módulo HTTP de plugins

Expone el contrato runtime entre el core y plugins cargados dinámicamente.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/plugins/artifacts` | Artifact types (incluye `pluginId`, `generatable`, `requires`, `contentType`) |
| GET | `/plugins/health` | Snapshot de boot: plugins cargados, hooks registrados |
| GET | `/plugins/settings-panels` | Paneles de Ajustes declarados por plugins |
| GET | `/plugins/user-settings` | Mapa de ajustes del usuario autenticado |
| GET | `/plugins/:pluginId/user-settings` | Ajustes de un plugin |
| PUT | `/plugins/:pluginId/user-settings` | Guardar ajustes (validación opcional del plugin) |
| GET | `/plugins/projects/:id/plugin-data/:pluginId` | Datos del plugin por proyecto |
| PUT | `/plugins/projects/:id/plugin-data/:pluginId` | Persistir datos del plugin |
| POST | `/plugins/projects/:id/generate/:pluginId/:artifactId` | Generar artifact (cola `plugin-artifact` o sync) |

## Servicios relacionados (core)

| Servicio | Rol |
|----------|-----|
| `PluginLoaderService` | Carga dinámica, registro de hooks y artifacts |
| `PluginDocumentPipelineService` | Invoca `before/afterDocumentRender` y lifecycle desde generadores |
| `PluginArtifactService` | Orquesta `generateArtifact` → `project.pluginData` |
| `PluginUserSettingsService` | Persistencia en `UserAISettings.pluginUserSettings` |

## Motor de generación

- **Modo A (hooks):** `AiService.finishDocumentGeneration` → `generateWithDocumentHooks` — integrado en todos los generadores LLM de entregables (`spec`, `architecture`, `tasks`, `blueprint`, `api-contracts`, `logic-flows`, `infra`, `use-cases`, `user-stories`, `agent-governance`, `aem`, `ux-ui-guide`). `ProjectsService` pasa `hookContext` vía `withHookGenerateOpts` y dispara `afterDocumentPersist` tras persistir.
- **Modo B (artifacts):** `POST …/generate/…` → cola `plugin-artifact`; Workshop usa `generateAndPollPluginArtifact` con guards de `requires` y estado `generationStatus.busy`.

Plugin de desarrollo: `plugins-enabled/stub-plugin/` (`dev.theforge.stub-plugin`).

Ver `docs/PLUGINS.md` y `docs/ARCHITECTURE_PLUGINS.md`.
