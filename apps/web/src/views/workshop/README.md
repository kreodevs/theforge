# views/workshop

Subcomponentes extraídos de `WorkshopView.tsx` (Fase 5b del [GOD-REFACTOR](../../../docs/GOD-REFACTOR.md)).

| Archivo | Uso |
| ------- | --- |
| **WorkshopDocToolbarHint.tsx** | Hint de orden de pestañas según complejidad (LOW / MEDIUM / HIGH) y tipo de proyecto (legacy vs greenfield). En HIGH muestra resumen compacto; el flujo completo se abre desde el modal del toolbar. |

Utilidades puras compartidas con otros módulos viven en `utils/workshopDocToolbar.ts`.

Próximas extracciones planificadas: `WorkshopHeaderBar`, `WorkshopDocPanel`, `WorkshopModals`.
