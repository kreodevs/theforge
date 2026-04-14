# Sessions

Gestión de sesiones de chat del Workshop y parseo de respuestas que incluyen documentos (MDD, UX/UI, DBGA, etc.).

- **SessionsService:** CRUD de sesiones, `chat`, `chatStream`, `generateWelcome`. Orquesta IA y persistencia del log. Mensajes en `chatLog` pueden incluir **`stageId`** (etapa en foco al enviar; el hilo sigue siendo global por proyecto). `POST :id/messages` acepta `stageId` opcional (`appendChatSchema`). Hacia el LLM se reenvían **`projectTypeForUxGuide`** y **`uxGuideAdditionalDocs`** (Guía UX/UI + Prompt Stitch solo en tab `ux-ui-guide`, vía `AiOrchestratorService` + `ux-guide-llm-context.ts`).
- **ChatResponseParserService:** Separa documento vs mensaje de chat (delimitadores `---FIN_MDD---`, etc.), fusiona secciones de MDD y limpia contenido. Una sola responsabilidad: parseo de respuesta.
- **document-content.util.ts:** Funciones puras `normalizeDashes`, `stripChatLabel`, `cleanDocumentContent` (sin DI). Usado por el parser y por Projects/Legacy para limpiar contenido antes de persistir.
