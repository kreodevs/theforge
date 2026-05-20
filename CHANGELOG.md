     1|     1|# Changelog
     2|     2|
     3|     3|Todas las notas relevantes de este repositorio se documentan aquí. El formato sigue una variante orientada a release técnico (Added / Changed / Fixed / Architecture).
     4|     4|
     5|     5|## [0.7.1] — 2026-05-21
     6|     6|
     7|     7|### Fixed
     8|     8|
     9|     9|- **Cascada de documentos trabada en "Generando...":** El polling frontend consultaba `j.state` pero la API devuelve `j.status`. Nunca detectaba "completed" y el loop seguía hasta el deadline de 45 min.
- **Botón reparar YAML frontmatter de Guía UX/UI ahora usa LLM con contexto MDD:** Antes solo hacía regex sobre el body existente (fallaba si el formato no era limpio). Ahora llama al endpoint `POST /projects/:id/repair-ux-ui-guide` que genera el YAML de diseño desde el MDD, Blueprint y Spec.
    10|- **Botón "Generar documentos" mostraba conteo incorrecto (125):** Cambiado de `cascadeProgress.length` (cuenta todos los ticks de polling) a `cascadeCompleted/cascadeTotal` (solo docs únicos completados).
    11|    10|- **Progreso sin visibilidad en el chat:** `agentProgress` ahora se muestra en el ChatContainer durante la cascada de entregables (`loadingReason === "deliverables-cascade"`).
    12|    11|
    13|    12|### Changed
    14|    13|
    15|    14|- **UX de progreso en cascada:** Ahora se inicializan los 11 documentos con `⚪ Nombre — Generando…` y al completarse cambian a `✅ Nombre — Terminado`. Se actualizan in-place en vez de acumular entradas duplicadas.
    16|    15|
    17|    16|---
    18|    17|
    19|    18|## [0.7.0] — 2026-05-19
    20|    19|
    21|    20|### Added
    22|    21|
    23|    22|- **Cascada de documentos en paralelo:** `generateDeliverablesCascade` reemplaza `for...of await` con `Promise.allSettled()`. Los 11 documentos (Blueprint, Spec, Arquitectura, etc.) se generan simultáneamente. HIGH: de ~5-22min a ~30s-2min. Cada documento es una llamada LLM independiente sin estado compartido — riesgo cero de `INVALID_CONCURRENT_GRAPH_UPDATE`.
    24|    23|- **Progreso visible en el chat:** `agentProgress` ahora acumula (append) cada documento completado con icono ✅. El botón muestra "Generando documentos (N)" con el conteo en vivo.
    25|    24|
    26|    25|### Changed
    27|    26|
    28|    27|- **`projects.service.ts`**: `completedCount` atómico en vez de array index para progreso real con paralelismo. Labels legibles para la UI (Blueprint, Spec, Arquitectura, etc.).
    29|    28|- **`workshopStore.ts`**: `generateDeliverablesCascade` usa `set((s) => ({ agentProgress: [...s.agentProgress, { agent, message }] }))` en vez de reemplazar.
    30|    29|- **`WorkshopView.tsx`**: Botón muestra "Generando documentos (N)" en vez de "Generando step (N/11)".
    31|    30|
    32|    31|### Fixed
    33|    32|
    34|    33|- **INVALID_CONCURRENT_GRAPH_UPDATE revertido (PR #175):** Security e Integration escriben ambos a `mddStructured` (canal `LastValue`). Revertidos a secuencial. CrossConsistency+DiagramInjector permanecen en paralelo porque escriben a canales distintos.
    35|    34|- **Docker build mcp-server (PR #171, #173, #174):** Contexto cambiado de subdirectorio a repo root para resolver workspaces npm. Agregados `@theforge/shared-types` y `@theforge/config` como dependencias. Producción copia `node_modules` raíz (npm hoist).
    36|    35|
    37|    36|---
    38|    37|
    39|    38|## [0.6.0] — 2026-05-19
    40|    39|
    41|    40|### Added
    42|    41|
    43|    42|- **NodeCacheService**: Cache en memoria por nodo LLM con TTL de 1 hora. Cada nodo del pipeline MDD (Clarifier, Software Architect, Security, Integration, LLM Formatter, Cross-Consistency) calcula un hash SHA-256 de sus campos de entrada y reusa el resultado si el input no cambió. En re-runs tras fallo, el ahorro es de ~70-85% del tiempo total del pipeline.
    44|    43|- **Paralelismo Security + Integration** (ambos grafos): Security (§6) e Integration (§7) corren en paralelo en el grafo `createMddGraph` (one-shot) y `createMddGraphWithManager` (Manager). Escriben keys distintas del estado (`mddStructured.seguridad` vs `mddStructured.integracion`). Ahorro ~15s.
    45|    44|- **Paralelismo Cross-Consistency + DiagramInjector** (grafo one-shot): CrossConsistency (read-only, produce `internalDirectives`) y DiagramInjector (code-only, inyecta diagramas) corren en paralelo tras LLMFormatter. Auditor espera a ambos mediante fan-in. Sin riesgo de precisión porque el Auditor usa shortcut code-only (99% casos) que no evalúa diagramas.
    46|    45|
    47|    46|### Changed
    48|    47|
    49|    48|- **`mdd-graph.ts`**: Los nodos LLM se envuelven con `wrapCache()` que checkea cache antes de ejecutar. Se añadió `routeAfterSecurity` → `format_after_redactor` (en vez de `integration`) para el caso default.
    50|    49|- **`ai-analysis.service.ts`**: Inyecta `NodeCacheService` y lo pasa a `createMddGraph` y `createMddGraphWithManager` via `MddGraphCompileOptions.nodeCache`.
    51|    50|
    52|    51|---
    53|    52|
    54|    53|## [0.5.0] — 2026-05-19
    55|    54|
    56|    55|### Added
    57|    56|
    58|    57|- **Cross-project table import (`get_project_tables` tool):** El Software Architect ahora puede importar tablas SQL de otro proyecto de TheForge durante la generación del MDD. Se invoca con `get_project_tables(projectId, tableNames?)`. Útil cuando un proyecto necesita tablas compartidas de un proyecto existente. Ver README sección "Cross-Project Table References".
    59|    58|- **MCP tool `get_project_tables`:** Nueva herramienta en el MCP server que expone la misma funcionalidad para acceso externo.
    60|    59|- **Detección de lenguaje natural para regenerar secciones:** El chat del MDD ahora reconoce frases como "regenera sección 2" sin necesidad del comando `/`.
    61|    60|
    62|    61|### Fixed
    63|    62|
    64|    63|- **Secciones §6-§7 preservadas al regenerar §2:** Doble capa: prompt + post-processing code para que el SA no reemplace Seguridad e Infraestructura con placeholders.
    65|    64|- **Líneas en blanco en tablas markdown:** Regla explícita en prompts para evitar renderizado roto.
    66|    65|- **Anti-Swagger/OpenAPI en §4:** Prohibición explícita con ejemplo concreto para evitar que el SA genere OpenAPI specs en vez de markdown plano.
    67|    66|
    68|    67|### Changed
    69|    68|
    70|    69|- **`tool-registry.ts`:** `getMddArchitectTools()` ahora retorna `[createGetProjectTablesTool()]` (antes array vacío).
    71|    70|
    72|    71|---
    73|    72|
    74|    73|## [0.4.0] — 2026-05-16
    75|    74|
    76|    75|### Changed
    77|    76|
    78|    77|- **BRD (greenfield y legacy):** El prompt de generación ahora exige que el BRD comience con la sección **«Pain Points & Problem Statement»**, incluyendo mapa de dolores (tabla), validación de demanda, perfil del cliente objetivo y consecuencias de no actuar. Los datos se extraen del DBGA o codebase doc; si falta evidencia se indica como «Por validar».
    79|    78|  - `apps/api/src/modules/projects/projects.service.ts` — prompt `DBGA_BRD_TOBE_SUGGEST_SYSTEM` + `brdPrompt` para greenfield
    80|    79|  - `apps/api/src/modules/legacy-flow/legacy-coordinator.service.ts` — prompts de BRD inicial y BRD de cambio para legacy
    81|    80|
    82|    81|### Added
    83|    82|
    84|    83|- **Sección Pain Points & Problem Statement en BRD:** Estructura estandarizada de 4 sub-secciones que obliga al LLM a documentar el problema de negocio antes de pasar a requisitos.
    85|    84|- **Botón «Reparar» en guía UX/UI:** Nuevo botón con icono Wrench en la toolbar del panel UX/UI Guide que toma el markdown existente (de IAs externas o copiado manualmente) y genera el YAML frontmatter estructurado para el preview visual de DesignMdPreview. Usa las funciones existentes `replaceYamlFrontMatter`, `extractDesignMdFrontMatter`, `fillDesignMdDefaults` y `tokensToYamlFrontMatter`.
    86|    85|
    87|    86|---
    88|    87|
    89|    88|## [0.3.0] — 2026-05-02
    90|    89|
    91|    90|### Added
    92|    91|
    93|    92|- **AEM (Análisis y Estrategia de Mercado)**: nueva pestaña en el Workshop con editor preview/source, auto-save al perder foco, y soporte en ZIP de descarga. Campo `aemContent` en Prisma + DTO + MCP tool `set_aem_content`.
    94|    93|- **Design token extraction**: reemplazado extractor LLM-based por tool MCP dedicado `extract_design_tokens` en AriadneSpecs (sin LLM, más rápido). Añadido método `extractDesignTokens()` en TheForgeService. Eliminado `design-token-extractor.ts`.
    95|    94|
    96|    95|### Changed
    97|    96|
    98|    97|- **Docs**: actualizados MCP server docs, CHANGELOG, README.
    99|    98|
   100|    99|---
   101|   100|
   102|   101|## [0.2.0] — 2026-05-02
   103|   102|
   104|   103|### Added
   105|   104|
   106|   105|- **BRD/To-Be/As-Is por Stage:** Campos `brdContent`, `toBeManualContent`, `asIsManualContent`, `brdApprovedAt`, `toBeApprovedAt` en Prisma `Stage`. Flujo greenfield: BRD → To-Be (gate opcional) → MDD. Flujo legacy: As-Is desde codebaseDoc → BRD/To-Be → MDD de cambio.
   107|   106|- **Gates BRD/To-Be:** `requireBrdTobeGate` por proyecto. Streams MDD emiten `blocked` si faltan aprobaciones. Preámbulo `composeBrdToBeAsIsPreamble` en síntesis MDD.
   108|   107|- **Etapas como cambios legacy:** Cada etapa de cambio es un `Stage` independiente con FalkorDB (`LegacyStage` nodos + `DERIVED_FROM` por ordinal). Dual-write legacy → stage para migración gradual.
   109|   108|- **Prompts incrementales en etapas legacy:** MDD de etapa base (hasta 30k chars) inyectado como contexto con instrucción "describe SOLO las modificaciones respecto a esta línea base".
   110|   109|- **BRD/To-Be legacy como reflejo del MDD inicial:** En Stage 1 se titulan "BRD (sistema actual)" y "Manual To-Be (sistema actual)".
   111|   110|- **Desambiguación en chat legacy:** Instrucción en prompt: "Si el usuario menciona un cambio o hay ambigüedad, preguntar si es consulta o cambio."
   112|   111|- **Botón "+ Nueva etapa de cambio":** En WorkshopView, modal con selección de etapa fuente para crear nuevas etapas legacy.
   113|   112|- **FalkorDB `syncLegacyStage` / `clearLegacyStage`:** Sincronización de nodos `:LegacyStage` con relaciones `DERIVED_FROM` y `HAS_LEGACY_STAGE`.
   114|   113|- **Schema `copyLegacyChangeFromStageId`:** En `createStageBodySchema` para copiar estado legacy entre etapas.
   115|   114|- **Variables de entorno:** Documentación completa de todas las variables `LEGACY_*`, `THEFORGE_CONTEXT_*`, `MCP_*`, `FALKORDB_*`, `PRISMA_*` y operacionales en `README.md` y `.env.example`.
   116|   115|
   117|   116|### Changed
   118|   117|
   119|   118|- **`LegacyCoordinatorService`:** Migración completa de métodos → `getLegacyChangeState()` + `persistLegacyChangeState()` con dual-write y fallback a `project.legacyFlowState`.
   120|   119|- **`createStage` en `proyectos.service.ts`:** Búsqueda de `parentStageId` por ordinal para FalkorDB `DERIVED_FROM`.
   121|   120|- **`WorkshopView.tsx` y `workshopStore.ts`:** ~30 referencias migradas de `project.legacyFlowState` → `activeLegacyState`.
   122|   121|- **Controller legacy:** Endpoints aceptan `stageId` opcional para operaciones multi-etapa.
   123|   122|- **Documentación:** `blueprint.md`, `mdd.md`, `PROJECT_BRAIN_DUMP.md` actualizados a v2.0 reflejando el estado actual del proyecto.
   124|   123|
   125|   124|### Fixed
   126|   125|
   127|   126|- **Error de build en Dokploy:** `@theforge/web#build` fallaba por `brdGateBlocked` declarada pero no usada en `WorkshopView.tsx`. Eliminadas IIFEs muertas. Commit `0a8c600`.
   128|   127|- **Legacy:** BRD/To-Be en Stage 1 ahora reflejan el MDD inicial como sistema actual, no como documento de cambio.
   129|   128|
   130|   129|### Impacto arquitectónico
   131|   130|
   132|   131|- **Nuevo eje en Pipeline MDD:** BRD/To-Be como precursores opcionales antes del MDD técnico. Gates que bloquean pasos LLM y emiten eventos `blocked`.
   133|   132|- **Grafo de etapas:** FalkorDB ahora modela relaciones `DERIVED_FROM` entre etapas legacy por ordinal, permitiendo trazabilidad completa de cambios.
   134|   133|- **Dual-write:** `legacyFlowState` en `legacyCoordinator` se escribe tanto en `project.legacyFlowState` como en `stage.legacyChangeState` durante migración.
   135|   134|
   136|   135|---
   137|   136|
   138|   137|## [0.1.0] — 2026-03-27
   139|   138|
   140|   139|### Added
   141|   140|
   142|   141|- **`@theforge/business-rules`**: paquete compartido con estimación de costo (MXN), parsing de horas fijas de infra, estructura de equipo por defecto y constantes alineadas con negocio. Fuente única de verdad para API y Workshop web.
   143|   142|- **Grafo SDD (FalkorDB) — lectura y salud** (`GraphMemoryService`):
   144|   143|  - `getSddStageSnapshot`: entidades y endpoints ingeridos por `projectId` + `stageId`.
   145|   144|  - `evaluateSddDependencyHealth`: coherencia `API_Endpoint -[:CONSUMES]-> DB_Entity` (conteo de huérfanos y bandera `isCoherent`).
   146|   145|- **Pipeline MDD** (`MddUpdatePipelineService`): con `graphScope` en complejidad **HIGH**, re-ingiere MDD al grafo y pasa `sddDomainGraphOk` al semáforo para **relajar** el camino documental estricto (edge_cases / field_types) cuando el grafo es coherente.
   147|   146|- **Legacy — puerta índice vs SDD**: `assertLegacyIndexSddGate` cruza índice Ariadne (MCP) con snapshot Falkor; discrepancia grave → `409` con código `LEGACY_INDEX_SDD_MISMATCH` y payload `gate`; resolución explícita en `legacyFlowState.legacyIndexSddResolution` (`trust_index` | `trust_sdd` | `proceed_with_warnings`). Feature flag `LEGACY_SDD_INDEX_GATE` (default activo).
   148|   147|- **Util `legacy-index-sdd-alignment.util.ts`**: heurísticas de solapamiento y umbrales tunables vía env (`LEGACY_SDD_*`).
   149|   148|- **Puertos de orquestación**: `PROJECTS_ORCHESTRATOR_PORT`, `THEFORGE_ORCHESTRATOR_PORT` con implementación `useExisting` sobre servicios concretos; tests de DI (`ai-orchestrator.di.spec.ts`, `semaphore.service.spec.ts`, specs de alineación legacy).
   150|   149|- **`gatherLegacyIndexSignals`** y **`legacyIndexHasUsableGraphEvidence`** en `theforge-evidence-context.util.ts` para reutilizar recolección MCP sin duplicar lógica.
   151|   150|- **Módulo** `graph-memory.module.ts` y documentación README en submódulos (ai-analysis graph-memory, ai-orchestrator, business-rules).
   152|   151|
   153|   152|### Changed
   154|   153|
   155|   154|- **`CostCalculatorService`** y **`apps/web/src/utils/costCalculator.ts`**: delegan en `@theforge/business-rules` (sin duplicar multiplicadores, buffer ni tarifas).
   156|   155|- **`SemaphoreService` (HIGH)**: nuevo input opcional `sddDomainGraphOk`; si el MDD tiene lagunas documentales pero el grafo SDD es sano, puede alcanzar **VERDE** con `precisionScore` ajustado (92 vs 95).
   157|   156|- **`MddUpdatePipelineService.process`**: ahora **async** e inyecta `GraphMemoryService`; `EngineModule` importa `GraphMemoryModule`.
   158|   157|- **`LegacyCoordinatorService`**: inyección de `GraphMemoryService`; manejo de `ConflictException` para el gate índice/SDD.
   159|   158|- **`AiOrchestratorService`**: depende de puertos `IOrchestratorProjectsPort` / `IOrchestratorTheForgePort` en lugar de clases concretas.
   160|   159|- **`ProjectsModule` / `TheForgeModule`**: exportan tokens de puerto para consumo del orquestador.
   161|   160|- **Documentación**: actualizaciones en `docs/notebooklm/THEFORGE-INDEX.md`, `docs/notebooklm/LEGACY-EVIDENCE-CONTEXT.md`, skill The Forge; ajustes en `docker-compose.yml`, `vite.config.ts` y paths TS del web según el paquete compartido.
   162|   161|
   163|   162|### Fixed
   164|   163|
   165|   164|- **Consistencia estimación**: elimina el riesgo de drift entre front (Workshop) y API al centralizar reglas en `business-rules`.
   166|   165|- **Semáforo HIGH**: reduce falsos AMARILLO cuando el modelo de dominio en grafo está enlazado aunque el texto MDD aún no cubra todos los apartados §3–§5.
   167|   166|- **Legacy**: evita avanzar con síntesis LLM cuando el índice MCP y el SDD ingerido divergen de forma grave, salvo resolución explícita del usuario.
   168|   167|
   169|   168|### Impacto arquitectónico (grafo de dependencias)
   170|   169|
   171|   170|- **Nuevo nodo de paquete**: `api` y `web` → `@theforge/business-rules` ← `@theforge/shared-types`.
   172|   171|- **`EngineModule` → `GraphMemoryModule`**: el motor de validación MDD/semáforo queda acoplado al subsistema de grafo (Falkor) en el camino HIGH con scope de proyecto/etapa.
   173|   172|- **`LegacyFlowModule` → `AiAnalysisModule`**: el coordinador legacy depende explícitamente de `GraphMemoryService` para gates de alineación.
   174|   173|- **Inversión de dependencias en orquestador**: `AiOrchestratorService` solo conoce interfaces (puertos); los módulos `projects` y `theforge` mantienen las implementaciones Nest y exportan los tokens.
   175|   174|
   176|   175|---
   177|   176|
   178|   177|Este documento representa el estado incremental del proyecto a fecha de **19 de mayo de 2026**.
   179|   178|