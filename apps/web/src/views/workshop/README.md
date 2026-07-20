# views/workshop

Subcomponentes extraídos de `WorkshopView.tsx` (Fase 5b del [GOD-REFACTOR](../../../docs/GOD-REFACTOR.md)).

| Archivo | Uso |
| ------- | --- |
| **WorkshopDocToolbarHint.tsx** | Hint de orden de pestañas según complejidad (LOW / MEDIUM / HIGH) y tipo de proyecto (legacy vs greenfield). En HIGH muestra resumen compacto; el flujo completo se abre desde el modal del toolbar. |
| **WorkshopHeaderBar.tsx** | Header global: título, badge Legacy, visibilidad privado/compartido, estado de sync, selector de etapa, nueva etapa, descarga ZIP, export SDD spec-kit, ayuda y línea MCP en proyectos legacy. |
| **WorkshopDocPanel.tsx** | Columna B: envuelve toolbar + área scrollable + bubble menu (desktop). |
| **WorkshopDocToolbar.tsx** | Toolbar del documento (preview/source, regen, imprimir, acciones móvil). Tipos en `workshopDocToolbar.types.ts`. |
| **WorkshopAuditModal.tsx** | Modal inline de auditoría MDD (calidad, gaps, regeneración por sección). |
| **WorkshopModals.tsx** | Agrupa todos los overlays al final del root (`AlertDialog`, patrones MDD, regen, AEM, etapa, flujo, DBGA, ayuda, modelos no disponibles). Tipos en `workshopModals.types.ts`. |
| **WorkshopStandardDocPanels.tsx** | Ocho entregables con `StandardDocPanel` (arquitectura, casos de uso, historias, blueprint, tasks, API, flujos, infra). Tipos en `workshopStandardDocPanels.types.ts`. |
| **WorkshopLegacyPanels.tsx** | Banner AS-IS, MDD Inicial, Integración y flujo de modificación legacy. Tipos en `workshopLegacyPanels.types.ts`. |
| **WorkshopBenchmarkPanel.tsx** | Pestaña Benchmark (Fase 0 + Deep Research). Tipos en `workshopBenchmarkPanel.types.ts`. |
| **WorkshopMddPanel.tsx** | Panel MDD: gates legacy, acciones (generar, formato, patrones, cascade), auditoría manual y editor. Tipos en `workshopMddPanel.types.ts`. |

Utilidades puras compartidas con otros módulos viven en `utils/workshopDocToolbar.ts`.

Próximas extracciones planificadas: spec/AEM/BRD/UX, agent-governance y paneles agente.
