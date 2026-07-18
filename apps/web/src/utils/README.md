# Utils (web)

Utilidades del Workshop y plugins.

| Archivo | Rol |
|---------|-----|
| `workshop-document-content.util.ts` | Normaliza markdown del editor Workshop: quita stamp API, limpia residuos (`cleanDocForWorkshop`) y aplica **`formatDocumentMarkdown`** (misma SSOT que `MddViewer` y persist API). `workshopDocumentBodiesEqual` compara cuerpos ya formateados. |
| `workshop-mdd-sync.util.ts` | **`resolveMddFetchMerge`**: decide servidor vs local en `fetchProject` (refresh, cambio de proyecto, fetch obsoleto post-grabar, cambios sin guardar). Tests en `workshop-mdd-sync.util.spec.ts`. |
| `tasksGenerationPrerequisites.ts` | Prerrequisitos UI para **Generar Tasks** (MDD, Spec, Blueprint, API si §4, Pantallas si `hasUxTeam`; legacy relaja Spec). Alineado con `runTasksPreflightStrict`. |
| `pluginApi.ts` | HTTP: artifacts, plugin-data, generación encolada, polling |
| `pluginArtifactContent.ts` | Serialización editor ↔ payload según `contentType` |

Ver `apps/web/src/components/PluginDocPanel.tsx`, `MddViewer.tsx` y `apps/web/src/store/workshopStore.ts`.
