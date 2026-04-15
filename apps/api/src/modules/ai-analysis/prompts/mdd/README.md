# Prompts MDD

- **`mdd-constitution-skeleton.md`** — Forma objetivo del documento: siete secciones, trazabilidad §1→§3→§4, §4.A (API propia) antes de §4.B (externas), profundidad mínima en §5, YAGNI. Encabezados en español aunque el brief venga en inglés. Referenciado en Clarifier y Software Architect; exportado en `load-prompts.ts` como `MDD_CONSTITUTION_SKELETON_MARKDOWN`. Además, `normalizeMddEnglishSubheadings` en `utils/mdd-sanitize.ts` corrige subtítulos EN frecuentes al volcar el borrador.
- Otros `.md` — clarifier, arquitecto, seguridad, integración, auditor, manager, etc.
