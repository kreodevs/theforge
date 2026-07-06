# @theforge/shared-types

DTOs e interfaces compartidas (Zod).

- Status, ChecklistResult, **MddJson** (`mddConstitutionSchema`, `constitution` opcional; `.passthrough()` para campos extra).
- **`mdd-pipeline-limits.ts`:** constantes de tamaño (brief, plan, goals, aviso de pegado largo en Workshop).
- **`markdown-repair.ts`:** export también vía subpath `@theforge/shared-types/markdown-repair` (MddViewer / limpieza de fences).
- **`format-document-markdown.ts`:** `/formatear` en Workshop (Fase 0 DBGA, BRD, etc.) — `repairPastedMarkdown` + tablas + Mermaid + **`repairInfraMarkdown`** (Dockerfile sin fence, `### WORKDIR`, compose YAML en viñetas, `.env`). `repairApiContractJsonFences` cierra JSON de Request/Response, quita ` ``` `+` ```json ` apilados, une JWT partido y no recorta el doc ante `###` (solo preámbolo antes de H1/H2).
- **`repair-directory-tree.ts`:** árboles de directorios del Blueprint colapsados en una línea → bloque ` ```text ` multilínea (vía `repairPastedMarkdown`).
- createProjectSchema, updateProjectSchema, sessionResponseSchema, etc.
- `ComplexityLevelEnum` (`LOW` | `MEDIUM` | `HIGH`): política de adopción SDD y semáforo (campo `complexity` en proyecto).
- `orchestrator.ts`: `chatOrchestratorResponseSchema` (respuesta stream/orquestador; incluye `evaluatorCritique` opcional).
- **`legacy-codebase-doc.ts`:** `codebaseDocResponseModeSchema`, `generateCodebaseDocRequestSchema` (body `POST …/legacy/generate-codebase-doc`).
- **`document-layout.ts`:** mapa spec-kit ↔ `docs/sdd/` para gobernanza (MDD, Paso 0, Spec, Arq., casos, H.U., Blueprint, Design System, Pantallas, API, Flujos, Tasks, Infra, ADRs) + suplemento Workshop (BRD, AEM, Handoff Spec).
- **`spec-kit-bundle.ts`:** `buildSpecKitBundleFiles` — export layout compatible con github/spec-kit.
- **`tasks-parse.ts`:** parseo spec-kit de `tasks.md` (`[P]`, rutas, checkpoints); `getNextOpenTask` para MCP.
- **`sdd-analyze.ts`:** tipos del reporte `GET /projects/:id/analyze`.
- **`mermaid.ts`:** normalización/reparación de diagramas (erDiagram PK/FK, **erDiagram BRD con viñetas/`###` dentro del fence**, fences partidos, cabeceras duplicadas, `subgraph ID["…"]` sin corromper a `subgraph_ID`, etiquetas de arista con acentos, `prepareMermaidDiagramForRender` sin fences); consumido por `normalizeMermaidInDocument`, `MarkdownMermaid` y `MddViewer`.
- **`sdd-integrations.ts`:** Zod `convergeBodySchema`, `tasksToIssuesBodySchema`.

Usado por API y (opcional) por web.
