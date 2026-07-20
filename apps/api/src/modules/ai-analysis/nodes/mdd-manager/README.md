# mdd-manager (Fase 2 GOD-REFACTOR)

Extracción modular de `../mdd-manager.node.ts` — nodo LangGraph Manager del pipeline MDD.

| Archivo | Exports | Notas |
|---------|---------|-------|
| `manager-constants.ts` | Umbrales y regex de routing | `QUALITY_THRESHOLD`, `PLAN_APPROVAL_CONFIRM_PATTERN`, etc. |
| `manager-context.util.ts` | `LOG`, `hasRealBenchmark`, `mddHasContent` | Helpers de estado del draft/benchmark |
| `manager-heuristics.ts` | `inferSectionsFromMessage`, `looksLike*` | Heurísticos de mensaje (sin LLM) |
| `manager-plan.ts` | `buildMddPlan`, `expandSectionsToRun`, `generateMddPlanWithLLM` | Planner–Executor: goals por paso |

El entrypoint estable sigue siendo `../mdd-manager.node.ts` (`createMddManagerNode`, re-export de `expandSectionsToRun`).

**Pendiente (Fase 2):** `manager-state-handlers.ts`, `manager-llm-turn.ts`, `manager-delegate.ts`, fachada `< 150 L`.
