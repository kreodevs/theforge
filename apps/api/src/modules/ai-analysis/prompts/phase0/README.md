# Prompts Phase 0 (entrevistador interactivo)

| Archivo | Uso |
|---------|-----|
| `arranque-prompt.md` | Borrador inicial + gaps (JSON). `flujos[].pasos` = texto plano, sin `##`. |
| `update-prompt.md` | Actualización tras respuesta del usuario (JSON; `impacto`/`cambios` en modo asistido). |
| `assisted-markdown-update-prompt.md` | Modo asistido: actualiza markdown DBGA/Deep Research + impacto. |
| `question-prompt.md` | Siguiente pregunta del plan. |
| `extract-dbga-prompt.md` | Extrae JSON desde DBGA markdown libre. |
| `merge-phase0-prompt.md` | Fusión de borradores multi-proyecto. |
| `phase0-markdown-format.md` | Reglas markdown canónico (§4 flujos). Export: `PHASE0_MARKDOWN_FORMAT_RULES`. |

Cargados desde `load-prompts.ts`. El refinado DBGA en chat (`phase0-benchmark-refine-prompt.md` + `sessions.service`) también incluye `PHASE0_MARKDOWN_FORMAT_RULES` cuando el documento es Fase 0 estructurado.
