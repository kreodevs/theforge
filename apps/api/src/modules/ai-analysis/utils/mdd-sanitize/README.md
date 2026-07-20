# mdd-sanitize (extracción modular)

Submódulos extraídos de `../mdd-sanitize.ts` durante el refactor GOD-REFACTOR (Fase 1+).

| Archivo | Export público | Notas |
|---------|----------------|-------|
| `json-section-to-markdown.ts` | `jsonSectionToMarkdown` | JSON de sección → markdown; `subsectionsToMarkdown` reutilizado por el barrel |

El entrypoint estable para consumidores sigue siendo `../mdd-sanitize.ts` (re-exports).
