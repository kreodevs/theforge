# Graph memory (FalkorDB)

- **`graph-memory.service.ts`:** Conexión al grafo `theforge_memory`, embeddings, ADRs, ingesta SDD (`syncMddToGraph`), consultas de solo lectura (`querySddGraphReadOnly`).
- **`evaluateSddDependencyHealth`:** Cuenta `DB_Entity` / `API_Endpoint` por etapa y detecta huérfanos (sin `CONSUMES` bidireccional mínimo); usado por el pipeline del MDD para relajar el semáforo HIGH cuando el grafo está coherente.
- **`graph-memory.module.ts`:** Módulo Nest que exporta `GraphMemoryService` (depende de `AiModule` para embeddings). Importado por `EngineModule` y `AiAnalysisModule`.
