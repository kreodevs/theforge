# Phase 0 (Paso 0 interactivo)

Entrevista IA guiada: borrador de 8 secciones, gaps y auditoría manual.

- **`phase0-interview.service.ts`** — `start`, `question`, `answer`, `audit`, `finalize`. En `processAnswer`, si el gap menciona APIs/tokens/OAuth, consulta **Context7** (credenciales del owner en Ajustes → Docs técnicas) e inyecta snippets en el prompt de actualización.
- **`phase0.module.ts`** — Nest module exportando solo `Phase0InterviewService` (sin `ProjectsModule`) para que `ProjectsModule` pueda inyectarlo sin ciclo con `AiAnalysisModule`.

`AiAnalysisModule` importa y re-exporta `Phase0Module`.

**Chat Fase 0 / Benchmark:** en el Workshop, pestañas `benchmark` o `phase0`, puedes escribir «Según Context7, …» para forzar una consulta documentada (ver `technology-docs-mcp/README.md`).
