# @theforge/shared-types

DTOs e interfaces compartidas (Zod).

- Status, ChecklistResult, **MddJson** (`mddConstitutionSchema`, `constitution` opcional; `.passthrough()` para campos extra).
- **`mdd-pipeline-limits.ts`:** constantes de tamaño (brief, plan, goals, aviso de pegado largo en Workshop).
- **`markdown-repair.ts`:** export también vía subpath `@theforge/shared-types/markdown-repair` (MddViewer / limpieza de fences).
- **`format-document-markdown.ts`:** `/formatear` + preview `MddViewer` — repara fences/tablas/Mermaid/infra. Antes de recortar el preámbulo (todo lo anterior al primer H1/H2) **preserva** la cabecera `Creado` / `Última regeneración` (`theforge-doc-stamp.ts`); sin eso el viewer ocultaba fecha y hora aunque estuvieran en la DB. **`repair-phase0-flow-format.ts`:** en Fase 0 §N Flujos convierte pasos mal emitidos como `## 1. …` a listas `1. …` y notas `### La cola…` a viñetas. **`repair-dbga-markdown.ts`:** DBGA/Fase 0 — doble H1, desenvelopa markdown en fences ` ```text ` erróneos, pseudo-tablas `| • |` / `| - 1. |`, `## 2.` huérfanos, secciones `4. Microservicios` / `3.6 …` / `4.1 …` sin `#`, viñetas `-**R5.1**`, diagramas con `- │` y headings duplicados.
- **`theforge-doc-stamp.ts`:** peel/reattach del stamp `<!-- theforge-doc:created|updated -->` + blockquote 📅.
- **`repair-directory-tree.ts`:** árboles de directorios del Blueprint colapsados en una línea → bloque ` ```text ` multilínea (vía `repairPastedMarkdown`).
- createProjectSchema, updateProjectSchema, sessionResponseSchema, etc.
- `ComplexityLevelEnum` (`LOW` | `MEDIUM` | `HIGH`): política de adopción SDD y semáforo (campo `complexity` en proyecto).
- `orchestrator.ts`: `chatOrchestratorResponseSchema` (respuesta stream/orquestador; incluye `evaluatorCritique` opcional).
- **`legacy-codebase-doc.ts`:** `codebaseDocResponseModeSchema`, `generateCodebaseDocRequestSchema` (body `POST …/legacy/generate-codebase-doc`).
- **`doc-consumption-guide.ts`:** SSOT `buildTheforgeDocConsumptionGuide` (layout spec-kit dual) para handoff y gobernanza.
- **`project.ts`:** `updateProjectSchema` incluye `uxGuideDesignRef` (biblioteca visual Design System).
- **`document-layout.ts`:** mapa spec-kit ↔ `docs/sdd/` para gobernanza (MDD, Paso 0, Spec, Arq., casos, H.U., Blueprint, Design System, Pantallas, API, Flujos, Tasks, Infra, ADRs) + suplemento Workshop (BRD, AEM, Handoff Spec).
- **`ui-screens-export.ts`:** split `---UI_PROJECT_JSON---`, preview formateado (`formatPantallasMarkdownForPreview`) y export limpio de `pantallas.md`.
- **`spec-kit-bundle.ts`:** `buildSpecKitBundleFiles` — export layout compatible con github/spec-kit.
- **`tasks-parse.ts`:** parseo spec-kit de `tasks.md` (`[P]`, rutas, checkpoints); `getNextOpenTask` para MCP.
- **`sdd-analyze.ts`:** tipos del reporte `GET /projects/:id/analyze`.
- **`mermaid.ts`:** normalización/reparación de diagramas (erDiagram PK/FK, **erDiagram BRD con viñetas/`###` dentro del fence**, fences partidos, cabeceras duplicadas, `subgraph ID["…"]`, secuencia sin cabecera, flechas/participantes, `resolveMermaidBlockForRender` para preview); `assessMermaidFixStrategy` prioriza reparación local si `validateMermaid` pasa tras el fix. Consumido por `normalizeMermaidInDocument`, `MarkdownMermaid` y `MddViewer`.
- **`sdd-integrations.ts`:** Zod `convergeBodySchema`, `tasksToIssuesBodySchema`.
- **`plugin.ts`:** `ArtifactTypeDefinition` (con `pluginId`, `generatable`, `requires`, `contentType`), `PluginArtifactContext`, `PluginArtifactResult`; job `plugin-artifact` en `project-generation-guard.ts` (incl. gate `project_busy`).
- **`workshop-fin-delimiter-covenant.ts`:** covenant LLM (`WORKSHOP_DBGA_EDIT_COVENANT`, `workshopFinDelimiterCovenant`) y mensajes al usuario cuando el panel del Workshop no persistió (sin mencionar `---FIN_*---` en la UI).
