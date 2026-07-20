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
| **WorkshopSpecBrdAemPanels.tsx** | Spec, AEM, UI Screens y BRD de etapa. Tipos en `workshopSpecBrdAemPanels.types.ts`. |
| **WorkshopAgentPanels.tsx** | Gobernanza de agentes, gaps pendientes y log de sesión. Tipos en `workshopAgentPanels.types.ts`. |
| **WorkshopUxGuidePanel.tsx** | Design System / UX guide (preview, design, source). Tipos en `workshopUxGuidePanel.types.ts`. |
| **WorkshopAdrsPluginPanels.tsx** | ADRs del grafo y paneles plugin dinámicos. Tipos en `workshopAdrsPluginPanels.types.ts`. |
| **WorkshopDocPanelContent.tsx** | Compositor del área scroll: encadena todos los subpaneles anteriores. Tipos en `workshopDocPanelContent.types.ts`. |
| **useWorkshopDocPanelProps.ts** | Hook que consolida los `useMemo` de props de todos los subpaneles del documento. Tipos de entrada en `useWorkshopDocPanelProps.types.ts`. |

Utilidades puras compartidas con otros módulos viven en `utils/workshopDocToolbar.ts`.

Próximas extracciones planificadas: columna métricas/chat, layout shell 3 columnas.
