# Phase 0 (Paso 0 interactivo)

Entrevista IA guiada: borrador de 8 secciones, gaps y auditoría manual.

- **`phase0-markdown-format.md`** — SSOT: §4 Flujos con `###` + listas `1.` (nunca `## 1.`). Exportado como `PHASE0_MARKDOWN_FORMAT_RULES` en `load-prompts.ts`; se inyecta en refinado DBGA y chat Fase 0.
- **`phase0-to-markdown.ts`** / **`phase0-from-markdown.ts`** — serialización canónica Fase 0. En §4 los pasos son listas `1. …`, `2. …` bajo `### Nombre del flujo`. El parser acepta también pasos mal formateados como `## N. …` (reparados por `repairPhase0FlowFormat` en `formatDocumentMarkdown`).
- **`phase0-interview.service.ts`** — `start`, `question`, `answer`, `audit`, `finalize`, **`startAssisted` / `processAssistedAnswer` / `stopAssisted`**. Persiste `dbgaContent` con `stampMarkdownIfBodyChanged` (preserva **Creado**, actualiza **Última modificación**). En `processAnswer`, si el gap menciona APIs/tokens/OAuth, consulta **Context7** (credenciales del owner en Ajustes → Docs técnicas) e inyecta snippets en el prompt de actualización.
- **`phase0-template-detect.util.ts`** — detección automática de plantilla: `structured` | `freeform_dbga` | `deep_research`.
- **`phase0-assisted.helpers.ts`** — plan de preguntas del modo asistido (hasta 30), reformateo y mensajes de chat con impacto/cambios.
- **`assisted-markdown-update-prompt.md`** — actualización de markdown vivo (DBGA libre / Deep Research) en modo asistido.
- **`phase0.module.ts`** — Nest module exportando solo `Phase0InterviewService` (sin `ProjectsModule`) para que `ProjectsModule` pueda inyectarlo sin ciclo con `AiAnalysisModule`.

## Modo asistido (chat Workshop)

API:

- `POST /ai-analysis/phase0/assisted/start` `{ projectId, idea? }`
- `POST /ai-analysis/phase0/assisted/answer` `{ projectId, answer, threadId? }`
- `POST /ai-analysis/phase0/assisted/stop` `{ projectId }`

Flujo: detectar plantilla → reformatear → una pregunta por turno en el chat del Workshop → inferir impacto y persistir markdown en cada iteración → apagar o completar gaps.

`AiAnalysisModule` importa y re-exporta `Phase0Module`.

**Chat Fase 0 / Benchmark:** en el Workshop, pestañas `benchmark` o `phase0`, puedes escribir «Según Context7, …» para forzar una consulta documentada (ver `technology-docs-mcp/README.md`).
