# Graph memory (FalkorDB)

- **`graph-memory.service.ts`:** Conexión al grafo `theforge_memory`, embeddings, ADRs, ingesta SDD (`syncMddToGraph`), consultas de solo lectura (`querySddGraphReadOnly`). Persiste `sddLastSyncedAt` / `sddMddFingerprint` en nodos `Stage`.
- **`sdd-graph-sync.service.ts`:** `syncMddAndEvaluate` (await antes del semáforo en pipeline MDD) y `evaluateFromMdd` (polling `GET …/generation-status` → `sddGraph`).
- **`sdd-graph-expectations.util.ts`:** Parsea expectativas §3/§4 del MDD vía `markdownToMddStructured`.
- **`sdd-graph-context.util.ts`:** Snapshot `shortTermContext.sddGraph` (huella + `lastSyncedAt`).
- **`sdd-consumes-link.util.ts`:** Inferencia `CONSUMES` por FK SQL, segmentos de ruta y mapa explícito (no substring en path).
- **`evaluateSddDependencyHealth`:** Cuenta `DB_Entity` / `API_Endpoint` por etapa y detecta huérfanos (sin `CONSUMES` bidireccional mínimo); usado por el pipeline del MDD para relajar el semáforo HIGH cuando el grafo está coherente.
- **`graph-memory.module.ts`:** Exporta `GraphMemoryService` y `SddGraphSyncService` (depende de `AiModule` para embeddings). Importado por `EngineModule`, `AiAnalysisModule` y `ProjectsModule`.

Estados expuestos al Workshop (`SddGraphSyncStatus`): **sincronizado**, **vacío**, **desactualizado**, **no disponible** (Falkor caído).
