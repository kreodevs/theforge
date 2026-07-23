# hooks

Hooks de la aplicación.

| Hook | Uso |
|------|-----|
| **useDashboardGenerationSummary.ts** | Poll cada 5s `GET /projects/generation-summary?ids=…` para marcar carpetas con job MDD/entregables en curso (`ProjectFolderTile`). Solo activo en el panel de proyectos (no Workshop). |
| **useInterview.ts** | Conecta al store del Workshop. Si `session.projectId` ≠ `project.id`, no muestra chat (evita mezcla entre proyectos durante `fetchProject`). Recibe projectId; expone messages, project, session, loading, error, sendMessage (opcional `images: ChatImagePart[]`). Inyecta en `messages` el turno en streaming con `streamingUserImages`. Usado por ChatContainer. |
| **useAutoSaveContent.ts** | Debounce 1,5s + blur → `persist*Content`. Compara cuerpo sin cabecera stamp (`workshop-document-content.util`) para evitar bucles PATCH DBGA/entregables. Compatible con `WorkshopDocTextarea` y `persist-field-guard`. |
