# Módulo AI — LLM, prompts y contexto

- **`ai.service.ts`** — `generateResponse` / `generateResponseStream`, ensambla system prompt (MDD, Blueprint, tab activo, etc.) y **`appendUxGuideStitchPolicy`** (Google Stitch solo proyectos **NEW** y tab **ux-ui-guide**; **LEGACY** prohíbe Stitch).
- **`ux-guide-llm-context.ts`** — `uxGuideLlmOptions(project)`: `projectTypeForUxGuide` + recortes de Spec, casos de uso, historias, flujos, arquitectura, API, DBGA, fase 0 para enriquecer la guía y el prompt Stitch del **producto**.
- **`prompts/`** — Markdown cargados en runtime; ver [prompts/README.md](prompts/README.md).
