# ui-spec

> ⚠️ **Nota:** Este documento es una especificación de diseño de UI. La implementación vigente está en `WorkshopView.tsx`, `SettingsView.tsx` y componentes relacionados. Ver [THEFORGE-INDEX.md](THEFORGE-INDEX.md) y el código fuente.

## 1. La Pantalla de "TheForge" (The Workshop)

Esta es la vista principal donde sucede la magia. Interfaz de **tres columnas** para mantener contexto.

### Columna A: El Asistente de Arquitectura (Panel de Chat)

- **Funcionalidad:** Interfaz de chat tipo "thread".
- **Estado de Persistencia:** Indicador **Sincronizado / Sincronizando** (PostgreSQL).
- **Progreso del flujo:** panel `WorkshopAgentProgressPanel` con checklist de pasos (MDD lean, cascada de entregables) — completados ✅, paso activo con animación, pendientes.
- **Comandos `/`:** regenerar una sección MDD (1–7) sin rehacer todo el documento.
- **Componente `InterviewStream`:** resalta preguntas cuando falta información para el verde del semáforo.

### Columna B: Visualizador del MDD en Tiempo Real

- **Funcionalidad:** Preview Markdown del documento activo (MDD, Spec, entregables…).
- **Stamp de trazabilidad:** barra **Creado / Última regeneración** (`WorkshopDocumentStampBar`) — fechas desde API, no duplicadas en el cuerpo del markdown.
- **Diagramas:** bloques Mermaid con toggle **Excalidraw / SVG** cuando el tipo lo permite (`MarkdownMermaid`); Excalidraw por defecto en diagramas compatibles; pantalla completa opcional.
- **Editor Preview:** edición manual de fragmentos cuando la IA entendió mal algo.

### Columna C: Panel de Control y Salida

- **Widget del Semáforo:** medidor circular (Rojo, Amarillo, Verde) según `precisionScore` y reglas `SemaphoreService`.
- **Motor de Estimación:** desglose MXN; se actualiza al cambiar el MDD.
- **Generar entregables:** activo en **Verde** + Spec; muestra progreso `(N/total)` durante cascada BullMQ.
- **Export spec-kit:** wizard **Llevar al repo** (`LlevarAlRepoWizardDialog`) — ZIP con layout [github/spec-kit](https://github.com/github/spec-kit), gobernanza y guía de consumo; también **Descargar todo (ZIP)** en header.
- **Info de proveedor:** botón en chat con tiers efectivos (Premium / Estándar / Ligero).

### Banners globales (Workshop)

- **Regeneración MDD en background:** banner «Regenerando MDD…» con botón **Detener** → `POST /projects/:id/mdd/cancel` (cancelación cooperativa).
- **Entregables en background:** banner informativo cuando hay job de cascada activo (sin Detener; esperar fin o recargar).

---

## 2. Ajustes (Settings)

Vista accesible desde el layout principal (`SettingsView`):

| Pestaña | Contenido |
|---------|-----------|
| **Proveedores de IA** | Instancias BYOK: clave API, tres modelos por tier (`chatModel` / `graphChatModel` / `architectChatModel`), badges **Ligero / Estándar / Premium**. |
| **Plugins** | Plugins instalados (`PluginSettingsSection`). |
| **Ariadne / Docs / MCP gráfico / Cuenta** | Integraciones y token MCP. |

Ya **no** es cierto que «solo env OpenRouter» — el usuario configura proveedores en UI; env es fallback de plataforma.

---

## 3. Flujo de Usuario de la Entrevista (Stepper Lógico)

La interfaz refleja hitos de la entrevista (aunque sea chat libre):

1. **Configuración Inicial:** stack, nombre, equipo UX.
2. **Modelado de Datos:** tablas y relaciones.
3. **Lógica y Seguridad:** roles, procesos, errores.
4. **Revisión y Estimación:** resumen y costo estimado.

**Paso 0 (opcional):** Benchmark & Gap Analysis antes del Spec.

---

## 4. Elementos de producto v1

- **Módulo de Carga de UX:** drag & drop JSON Figma si hay equipo UX.
- **Exportador spec-kit / handoff:** ZIP para repo destino (no solo Blueprint suelto).
- **Grupos de proyectos** en landing/admin; merge de proyectos vía API.
- **Etapas (`Stage`):** selector en header; MDD/semáforo por etapa.

---

## 5. Guía de Estilo y Librerías

- **Base:** Tailwind CSS + [Shadcn/UI](https://ui.shadcn.com/).
- **Iconografía:** Lucide React.
- **Gráficos:** Recharts (distribución costos/tiempo).
- **Diagramas interactivos:** `@excalidraw/excalidraw` + `@excalidraw/mermaid-to-excalidraw`.

---

*Corpus «The Forge - by Kreo» — NotebookLM sync 2026-07-16 (pnpm). Rutas relativas al monorepo `theforge`.*
