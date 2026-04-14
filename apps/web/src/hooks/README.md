# hooks

Hooks de la aplicación.

| Hook | Uso |
|------|-----|
| **useInterview.ts** | Conecta al store del Workshop. Recibe projectId; expone messages, project, session, loading, error, sendMessage (opcional `images: ChatImagePart[]`). Inyecta en `messages` el turno en streaming con `streamingUserImages`. Usado por ChatContainer. |
