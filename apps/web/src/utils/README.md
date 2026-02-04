# utils

Utilidades compartidas.

| Archivo                 | Uso                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **costCalculator.ts**   | Estimación final alineada con el backend: Base = Entidades×12 + Pantallas×16 + Endpoints extra×4; multiplicadores por TechnicalMetadata; horas fijas de infra; buffer 25% si semáforo ≠ VERDE. Total MXN = Total Horas × $1,050/hr. calculateCostFromMdd(mddContent, { status, infraContent }) para actualización instantánea en la Col C. |
| **markdownSections.ts** | parseMarkdownSections(content): divide el markdown en secciones por cabeceras (# … ## … ###). Cada sección tiene id estable (preamble, section-0, section-1, …) para que MddViewer solo re-renderice las secciones que cambian al hacer streaming.                                                                                         |
