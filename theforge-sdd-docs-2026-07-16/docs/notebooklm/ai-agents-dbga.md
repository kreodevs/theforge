# Technical Specification: AI Agentic Module for DBGA

**Status:** ✅ **Implementado** (2026-07) — `apps/api/src/modules/ai-analysis/`  
**Target Framework:** NestJS, LangGraph.js  
**Module Name:** `AiAnalysisModule`

> Fuente de verdad en código: [apps/api/src/modules/ai-analysis/README.md](../../apps/api/src/modules/ai-analysis/README.md).

## 1. Objective

Multi-agent system for **Domain Benchmark & Gap Analysis (DBGA)**. Orchestrates specialized agents to research, scrape, and synthesize market data from a raw user idea (Paso 0 / Benchmark).

## 2. Architecture & Patterns

- **Isolation:** Logic in `apps/api/src/modules/ai-analysis/`.
- **State Management:** LangGraph.js (`dbga-graph.ts`, `DBGAStateAnnotation`).
- **Asynchronicity:** BullMQ job queue (`theforge-mdd` / analysis jobs) + SSE/NDJSON streaming (`POST /ai-analysis/stream`, `phase0_deep_research`).
- **Scraper:** `scrape-cheerio.tool.ts` (Cheerio + fetch) — module `scraper/` for URL ingestion in Phase 0.
- **LLM runtime:** BYOK tenant tiers C/B/A via `create-dbga-llm.ts`; fallback OpenRouter env.

## 3. Data Schema (The "State")

Shared state between agents (`dbga-state.schema.ts`):

```tsx
interface DBGAState {
  rawIdea: string;
  competitors: CompetitorData[]; // From Scout
  techStackInsights: string[]; // From Tech Auditor node
  userPainPoints: string[];
  gapAnalysis: string; // From Synthesis
  status: "idle" | "researching" | "analyzing" | "finalizing";
}
```

## 4. Agent Definitions (Implemented)

Graph edges: **Scout → Tech Auditor → Critic → (Scout | Synthesis) → END**

### A. Market Scout (Researcher)

- **Tools:** Tavily (`TAVILY_API_KEY`), `scrape_url` (Cheerio).
- **Behavior:** Top competitors, UVP, pricing; verified URLs only.

### B. Tech Auditor (Technical)

- **Tools:** Web scraping (headers/metadata via scrape_url).
- **Behavior:** Stack inference from public data.

### C. Critic Agent (Validation)

- **Behavior:** Reviews Scout + Auditor; triggers re-research loop if output is generic.

### D. Synthesis

- **Behavior:** Final DBGA markdown via `stateToMarkdown()`; persisted as `dbgaContent` / `phase0SummaryContent`.

## 5. Implementation (done)

| Step | Estado | Ubicación |
|------|--------|-----------|
| Module boilerplate | ✅ | `ai-analysis.module.ts`, service, controller |
| LangGraph DBGA | ✅ | `graph/dbga-graph.ts`, `nodes/scout|auditor|critic|synthesis` |
| Tool registry | ✅ | `tools/tool-registry.ts`, Tavily, scrape-cheerio |
| NestJS integration | ✅ | `POST /ai-analysis/start`, `/stream`, `generate_benchmark`, `phase0_deep_research` |
| Checkpointer Postgres | ✅ | `AgentStateCheckpoint` (Prisma) |
| Architectural preferences | ✅ | `POST /ai/preferences/learn-from-mdd` |

## 6. Persistent Memory (Implemented)

- **Checkpointer:** PostgresSaver / Prisma `AgentStateCheckpoint`. Resume with `{ idea, projectId }`.
- **Semantic memory:** `ArchitecturalPreference` injected into Scout and Master Prompt on Fase 0 / Workshop chat.
- **Master Prompt:** `HISTORIAL_DE_APRENDIZAJE` section — consistency across projects.

## 7. Anti-Patterns (still enforced)

1. **NO** logic inside controllers.
2. **NO** hardcoded prompts — use `prompts/benchmark/` and `load-prompts.ts`.
3. **NO** blocking long runs without queue/stream.
4. **NO** generic `any` — Zod schemas for agent outputs.

---

*Corpus «The Forge - by Kreo» — NotebookLM sync 2026-07-16 (pnpm). Rutas relativas al monorepo `theforge`.*
