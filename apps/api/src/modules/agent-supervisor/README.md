# Agent Supervisor

Router agéntico dual (SDD nuevo vs legacy TheForge): resuelve `SupervisorRouteResult` a partir del `Project` y la `Stage` principal.

- **`AgentSupervisorService`** — `resolveRoute` / `resolveRouteFromProject`, STM (`setShortTermContext`), memoria episódica (`appendEpisodicMemory`, `getRecentEpisodicMemory`).
- **`AgentEvaluatorService`** — `evaluateLegacyProposal`: plan TheForge + `validate_before_edit`; si falla heurística, escribe `EVALUATOR_REJECTION` en episodios. Activo en orquestador solo con `AGENT_EVALUATOR_LEGACY=true`.
- **Tools combinadas:** `getAgenticRagToolset` en `ai-analysis/tools/tool-registry.ts` → `query_sdd_graph`, `supervisor_query_sdd_graph` (Cypher expresivo, mismo guard de lectura), `patch_mdd_section`, `propose_mdd_amendment` (enmienda §3/§4 desde Blueprint/API), y si legacy + TheForge → `ask_codebase`, `get_modification_plan`, `validate_before_edit`, `get_file_content`, `get_legacy_impact`.

Prisma: `Stage`, `EpisodicMemory`. Falkor SDD: `FALKORDB_SDD_URL` (fallback `FALKORDB_URL`). Ingesta MDD → grafo: `SddIngestorService` (`ai-analysis`).

**API:** `GET /agent-supervisor/episodic/:projectId` — últimas entradas de memoria episódica de la etapa principal.

**Workshop chat:** respuesta puede incluir `evaluatorCritique` si `AGENT_EVALUATOR_LEGACY=true` y el evaluador rechaza el plan legacy.
