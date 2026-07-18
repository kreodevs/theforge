# Utils (web)

Utilidades del Workshop y plugins.

| Archivo | Rol |
|---------|-----|
| `workshop-document-content.util.ts` | Normaliza markdown del editor Workshop: quita stamp API, limpia residuos (`cleanDocForWorkshop`) y aplica **`formatDocumentMarkdown`** (misma SSOT que `MddViewer` y persist API). `workshopDocumentBodiesEqual` compara cuerpos ya formateados. |
| `pluginApi.ts` | HTTP: artifacts, plugin-data, generación encolada, polling |
| `pluginArtifactContent.ts` | Serialización editor ↔ payload según `contentType` |

Ver `apps/web/src/components/PluginDocPanel.tsx`, `MddViewer.tsx` y `apps/web/src/store/workshopStore.ts`.
