# views/workshop

Subcomponentes extraídos de `WorkshopView.tsx` (Fase 5b del [GOD-REFACTOR](../../../docs/GOD-REFACTOR.md)).

| Archivo | Uso |
| ------- | --- |
| **WorkshopDocToolbarHint.tsx** | Hint de orden de pestañas según complejidad (LOW / MEDIUM / HIGH) y tipo de proyecto (legacy vs greenfield). En HIGH muestra resumen compacto; el flujo completo se abre desde el modal del toolbar. |
| **WorkshopHeaderBar.tsx** | Header global: título, badge Legacy, visibilidad privado/compartido, estado de sync, selector de etapa, nueva etapa, descarga ZIP, export SDD spec-kit, ayuda y línea MCP en proyectos legacy. |
| **WorkshopDocPanel.tsx** | Columna B: envuelve toolbar + área scrollable + bubble menu (desktop). |
| **WorkshopDocToolbar.tsx** | Toolbar del documento (preview/source, regen, imprimir, acciones móvil). Tipos en `workshopDocToolbar.types.ts`. |

Utilidades puras compartidas con otros módulos viven en `utils/workshopDocToolbar.ts`.

Próximas extracciones planificadas: contenido scroll del panel (por tab), `WorkshopModals`.
