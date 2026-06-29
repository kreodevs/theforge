---
id: agentes-ia-langgraph
title: Agentes IA (LangGraph)
category: Arquitectura
last_updated: 2026-06-29
---

# Agentes IA (LangGraph)

> **AI Context Brief:** El módulo `ai-analysis` orquesta los agentes con LangGraph: un Manager delega en especialistas que redactan/auditan el MDD. El proveedor LLM es agnóstico (BYOK). Léelo antes de tocar nodos del grafo o prompts.

## 1. Uso Básico (Quick Start)

```typescript
// Dos grafos principales:
//   graph/dbga-graph.ts → createDbgaGraph   (START → scout → auditor → critic → … → END)
//   graph/mdd-graph.ts  → createMddGraphWithManager (START → manager → especialistas → auditor → manager)

// El Manager decide la acción del LLM:
//   { action: "reply" | "delegate" | "search_memory" }
// y enruta a clarifier / pipeline / executor (HITL vía interrupt()).

// Proveedor LLM agnóstico (BYOK):
import { AIFactory } from "@/modules/ai/ai.factory"; // openrouter|openai|cloudflare|groq|anthropic|gemini
```

## 2. API & Contrato de Tipos (Specs)

| Pieza                       | Archivo                                                       | Rol                                                  |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Grafo MDD                   | `ai-analysis/graph/mdd-graph.ts` (`createMddGraphWithManager`) | Manager → especialistas → auditor (interrupt/resume).|
| Grafo DBGA                  | `ai-analysis/graph/dbga-graph.ts` (`createDbgaGraph`)         | scout → auditor → critic → synthesis.                |
| Manager                     | `nodes/mdd-manager.node.ts` (`createMddManagerNode`)          | Orquesta: delegate / reply / aprobación de plan / gaps. |
| Arquitecto SW               | `nodes/mdd-software-architect.node.ts`                        | §2 stack + §3 SQL + §4 API.                          |
| Auditor                     | `nodes/mdd-auditor.node.ts`                                   | Puntúa el MDD (≥85% → handoff al usuario).           |
| Inyector de diagramas       | `nodes/mdd-diagram-injector.node.ts`                          | Inserta Mermaid ER/flow.                             |
| Populador de grafo          | `nodes/mdd-graph-populator.node.ts`                           | Sincroniza MDD → grafo SDD (FalkorDB).               |
| IntegrationAgent            | `nodes/integration-agent.node.ts` (`runIntegrationAgent`)     | Redacta `handoff-spec.md` (NO es nodo del grafo).    |
| Factory de proveedor        | `ai/ai.factory.ts` (`AIFactory.create`)                       | Selecciona proveedor según `UserLLMRuntime`.         |
| Prompts                     | `ai-analysis/prompts/load-prompts.ts` (`benchmark/`, `mdd/`) + `ai/prompts/*.md` | Carga prompts desde disco.        |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** El **Manager** es el único punto de delegación; añade especialistas como nodos enrutados desde él, no como llamadas sueltas.
- **Regla 2:** El proveedor LLM es **agnóstico** (BYOK por usuario): nunca hardcodees un proveedor; usa `AIFactory.create()`.
- **Regla 3:** Los prompts viven en disco (`.md`) y se cargan con `load-prompts.ts`; edítalos ahí, no embebidos en código.
- **Regla 4:** El HITL (aprobación de plan, asignación de gaps) usa `interrupt()`/checkpointer; respeta ese patrón al añadir pasos que requieran intervención humana.
- **Regla 5:** `integration-agent.node.ts` exporta `runIntegrationAgent()` y se invoca desde su servicio, **no** está cableado en el grafo MDD.
