# Phase 0 (Paso 0 interactivo)

Entrevista IA guiada: borrador de 8 secciones, gaps y auditoría manual.

- **`phase0-interview.service.ts`** — `start`, `question`, `answer`, `audit`, `finalize`.
- **`phase0.module.ts`** — Nest module exportando solo `Phase0InterviewService` (sin `ProjectsModule`) para que `ProjectsModule` pueda inyectarlo sin ciclo con `AiAnalysisModule`.

`AiAnalysisModule` importa y re-exporta `Phase0Module`.
