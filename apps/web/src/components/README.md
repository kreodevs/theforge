# Componentes (`apps/web/src/components`)

| Componente | Rol |
|------------|-----|
| **Phase0ManualAudit** | Botón **Auditar Paso 0**: audita el **dbgaContent** visible en pestaña Fase 0 (DBGA libre o entrevista estructurada); no exige JSON de entrevista. `POST …/phase0/audit` → gaps/preguntas o `audit_complete`. |
| **MddManualAudit** | Botón **Auditar MDD**: audita el **mddContent** visible en pestaña MDD (`POST …/mdd/audit` / `…/mdd/audit/answer`). Reutiliza nodo Auditor MDD + preguntas por gaps. |
| **Phase0InterviewPanel** | Entrevistador interactivo Paso 0 (`start` → preguntas → `answer`). Incluye auditoría manual al completar. |
| **MddViewer** | Preview markdown (Fase 0, MDD, BRD, Blueprint): `repairDirectoryTreeBlocks` + detección `((Root))`/`— apps/` envuelve árboles en ` ```text `; párrafos colapsados → `<pre>` monoespaciado. Mermaid vía `MarkdownMermaid` (pantalla completa). |
| **DashboardSidebar** | En Workshop, «Panel de proyectos» queda `disabled` mientras `selectWorkshopAgentsBusy` (mismo criterio que el chat). |
| **DashboardPanelHeader** | Panel de proyectos: acciones Crear / Tutorial / Refrescar. |
| **ProjectTutorialDialog** | Tutorial **Greenfield** vs **Brownfield** (`content/tutorial/*.md`). Renderiza bloques ` ```mermaid ` como SVG vía `MarkdownMermaid.tsx`. |
| **MarkdownMermaid** | Bloques Mermaid en markdown (MDD, tutorial, ayuda). Botón inteligente **Reparar** / **Regenerar** (izq.): reparación local o `POST /ai/mermaid/regenerate` vía LLM si el diagrama está truncado o muy dañado. **Pantalla completa** (der.). |
| **AnalyzeDashboard** | Panel **Analizar — consistencia SDD** (`GET …/projects/:id/analyze`): presencia MDD/Spec/UC/HU/Tasks/API/Flujos/UX/Infra/Gov, puente Phase0→BRD/Spec, hallazgos agrupados por categoría. |
| **ProjectMergeDialog** | Fusión de 2+ carpetas en Paso 0: config (destino, benchmark, suite, archivado), preview con conflictos, `POST /projects/merge`. |
| **AemGenerateDialog** | Modal **Generar AEM**: elige alcance geográfico (Global / México / LATAM) y llama `POST /projects/:id/generate-aem` (Benchmark + Fase 0 + BRD + dictamen de inversión digital). |
| **RenameProjectDialog** | Renombrar proyecto (`PATCH /projects/:id` con `{ name }`). Lápiz en carpeta del dashboard, barra de selección (1 carpeta) y header del Workshop. |
| **CloneProjectDialog** | Clonar proyecto (`POST /projects/:id/clone`). Barra de selección con una carpeta: «Clonar» → nombre por defecto «Copia de …»; abre el Workshop en el clon. |
| **Phase0ManualAudit** | Acepta `initialAudit` para reanudar auditoría tras fusión (`audit_started` / `audit_complete`). |
| **MddPatternsWizardDialog** | Selector SSOT con pestañas verticales (`initial \| edit`): títulos = categorías del wizard MDD (emoji + texto original). Antes de abrir: `POST …/mdd/suggest-governance-patterns` (DBGA, benchmark, BRD). Al confirmar: MDD solo con patrones `[X]` + `POST …/mdd/record-governance-pattern-adrs`. |
| **ProviderInstancesCard** | CRUD/listado de instancias de proveedor IA; marca la instancia **Activa** (runtime del grafo MDD y chat). En el modal, **Modelo de auditor** opcional (`auditorChatModel`) para el nodo Auditor MDD. |
| **AccountConfigCard** | Ajustes → Cuenta: secret MCP rotable y preferencias del taller. |
| **McpSecretCard** | Re-export de `AccountConfigCard` (compat). |
| **AriadneConfigCard** | URL/token MCP de Ariadne (base de conocimientos). |
| **UiMcpInstancesCard** | Ajustes → **MCP gráfico**: CRUD team-wide de MCPs de componentes UI (`/api/ui-mcp`), activar/desactivar, **detectar compatibilidad** (badge compatible/no + librería/versión + contrato). Solo admin/super_admin. Habilita componentes reales en UI/UX del MDD/Blueprint y el deliverable «Pantallas». |
| **DesignRefSelector** | Biblioteca visual en pestaña **Design System**: catálogo `GET /api/design-refs`, badge `DESIGN.md` si hay import; al cambiar referencia con MDD+Blueprint se aplica **fast path** (`POST /projects/:id/compose-ux-guide-from-ref`, sin LLM) y solo cae al stream si no hay match o es legacy con codebase AS-IS. |
| **UxUiGuidePanel** | Design System: preview / design kit / fuente + barra **DesignRefSelector** antes de generar. |
| **LegacyMcpDebugPanel/** | Panel colapsable (MDD Inicial, LEGACY): traza petición↔respuesta JSON-RPC con Ariadne cuando el API envía `mcpDebugTrace` (`LEGACY_CODEBASE_DOC_MCP_DEBUG_UI=1`); botón **Copiar traza**. En **WorkshopView**, **Copiar MDD** junto al título copia el markdown de partida. Ver README en la carpeta. |
| **WorkshopHelpModal** | Modal **Ayuda — TheForge** (Workshop): manual, **Integración Legacy ↔ Nuevo**, SDD y referencia por documento. Renderiza Mermaid en markdown. |
| **WorkshopDbgaRestoreDialog** | Modal **Versiones anteriores del DBGA** (Fase 0): lista snapshots (`GET …/document-snapshots?field=dbgaContent`) y restauración (`POST …/document-snapshots/:id/restore`). Botón en toolbar y acciones del panel benchmark. |
| **IntegrationPanel** | Pestaña **Integración**: enlace NEW↔LEGACY, handoff NEW-LEG, import en etapa 2+, matriz trazabilidad. |
