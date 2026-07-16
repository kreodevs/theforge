---
id: agentes-ia-langgraph
title: Agentes IA (LangGraph)
category: Arquitectura
last_updated: 2026-07-16
---

# Agentes IA (LangGraph)

> **AI Context Brief:** El módulo `ai-analysis` orquesta los agentes con LangGraph: un **Manager delgado** delega en cuatro generadores que redactan el MDD; un **Quality Gate** valida la salida antes de `graph_populator`. El proveedor LLM es agnóstico (BYOK) con tres tiers C/B/A por instancia. Léelo antes de tocar nodos del grafo o prompts.

## 1. Uso Básico (Quick Start)

```typescript
// Dos grafos principales:
//   graph/dbga-graph.ts → createDbgaGraph   (START → scout → auditor → critic → … → END)
//   graph/mdd-graph.ts  → createMddGraphWithManager (START → manager → generadores → quality_gate → graph_populator)

// El Manager decide la acción del LLM:
//   { action: "reply" | "delegate" | "search_memory" }
// y enruta a clarifier / pipeline / secciones parciales (HITL vía interrupt()).

// Tres tiers de modelo (ProviderInstance):
//   chatModel (C) → chat, intent router, graph_populator
//   graphChatModel (B) → clarifier, manager, security, integration, quality_gate
//   architectChatModel (A) → software_architect, legacy coordinador

// Proveedor LLM agnóstico (BYOK):
import { AIFactory } from "@/modules/ai/ai.factory";
```

## 2. API & Contrato de Tipos (Specs)

| Pieza                       | Archivo                                                       | Rol                                                  |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Grafo MDD                   | `ai-analysis/graph/mdd-graph.ts` (`createMddGraphWithManager`) | Manager → 4 generadores → formatter → diagram → quality_gate → graph_populator. |
| Grafo MDD one-shot          | `ai-analysis/graph/mdd-graph.ts` (`createMddGraph`)           | Sin Manager; jobs de sección / pipeline completo.    |
| Grafo DBGA                  | `ai-analysis/graph/dbga-graph.ts` (`createDbgaGraph`)         | scout → auditor → critic → synthesis.                |
| Manager                     | `nodes/mdd-manager.node.ts` (`createMddManagerNode`)          | Orquesta delegate/reply; absorbe ask_initial_topic y plan_approval. |
| Clarifier                   | `nodes/mdd-clarifier.node.ts`                                 | §1 — contexto y alcance (tier B).                    |
| Arquitecto SW               | `nodes/mdd-software-architect.node.ts`                        | §2–§5 stack, SQL, API (tier A).                      |
| Security / Integration      | `nodes/mdd-security.node.ts`, `mdd-integration.node.ts`       | §6 y §7 (tier B); fanout paralelo vía `fanout_sec_int`. |
| Quality Gate                | `nodes/mdd-quality-gate.node.ts` + `utils/mdd-quality-gate.util.ts` | Validación determinista + LLM opcional; `ok` cuando `blockers.length === 0`. |
| Formatter / Diagram         | `nodes/mdd-formatter.node.ts`, `mdd-diagram-injector.node.ts` | Deterministas; sin `llm_formatter`.                    |
| Inyector de diagramas       | `nodes/mdd-diagram-injector.node.ts`                          | Inserta Mermaid ER/flow.                             |
| Populador de grafo          | `nodes/mdd-graph-populator.node.ts`                           | Sincroniza MDD → grafo SDD (FalkorDB, tier C).       |
| Auditor (manual)            | `nodes/mdd-auditor.node.ts`                                   | Solo `MddManualAuditService`; **no** en grafo lean.  |
| IntegrationAgent            | `nodes/integration-agent.node.ts` (`runIntegrationAgent`)     | Redacta `handoff-spec.md` (NO es nodo del grafo).    |
| Factory LLM                 | `ai-analysis/llm/create-dbga-llm.ts`                          | `createDbgaLLM` (C), `createGraphLLM` (B), `createArchitectLLM` (A). |
| Factory de proveedor        | `ai/ai.factory.ts` (`AIFactory.create`)                       | Selecciona proveedor según `UserLLMRuntime`.         |
| Prompts                     | `ai-analysis/prompts/load-prompts.ts` (`benchmark/`, `mdd/`) + `ai/prompts/*.md` | Carga prompts desde disco.        |

## 3. Decisiones de Diseño y Restricciones

- **Regla 1:** El **Manager** es el único punto de delegación interactivo; añade especialistas como nodos enrutados desde él, no como llamadas sueltas.
- **Regla 2:** El proveedor LLM es **agnóstico** (BYOK por usuario): nunca hardcodees un proveedor; usa `AIFactory.create()` y los factories `create*LLM`.
- **Regla 3:** Los prompts viven en disco (`.md`) y se cargan con `load-prompts.ts`; edítalos ahí, no embebidos en código.
- **Regla 4:** El HITL (gaps del Quality Gate, `acknowledgeGaps`) usa `interrupt()`/checkpointer; respeta ese patrón al añadir pasos que requieran intervención humana.
- **Regla 5:** `integration-agent.node.ts` exporta `runIntegrationAgent()` y se invoca desde su servicio, **no** está cableado en el grafo MDD.
- **Regla 6 (lean):** Eliminados del grafo: `architect_critic`, `cross_consistency_checker`, `llm_formatter`, `blackboard`, `security_integration`, `executor`, `plan_approval`, `ask_initial_topic`, loop `delivery_gate` y auditor como gate final. Salida: `qualityGate.ok` o máx. 2 rondas Manager → generador.

## 4. Chat Workshop (fuera del grafo)

| Intención | Modelo | Comportamiento |
|-----------|--------|----------------|
| explore / chat_only | **C** (8K) | Sin perfil `document` 32K en tab MDD |
| direct_edit, tab ≠ mdd | **B** | Edición documento |
| direct_edit, tab mdd | — | Encola job `section` del pipeline; chat responde con poll |

Ver `resolve-model-by-intent.util.ts` y `docs/notebooklm/mdd-lean-migration.md`.
