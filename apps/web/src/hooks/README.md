# hooks

Hooks de la aplicación.

| Hook | Uso |
|------|-----|
| **useInterview.ts** | Conecta al store del Workshop. Recibe projectId; expone messages, project, session, loading, error, sendMessage (opcional `images: ChatImagePart[]`). Inyecta en `messages` el turno en streaming con `streamingUserImages`. Usado por ChatContainer. |
| **useAutoSaveContent.ts** | Debounce 1,5s + blur → `persist*Content`. Compatible con `WorkshopDocTextarea` y `persist-field-guard` (no sobrescribe texto en curso al volver el PATCH). |
