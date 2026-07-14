# TheForge v1.5 — Lean SDD Integration

## Overview
This release adds deterministic, deterministic post-audit nodes to the MDD LangGraph pipeline that extract `types.json` and `operations.json` from the raw MDD draft, generate a v2 `tasks.json` using an inference engine, and expose the results in the Workshop frontend. The goal is to let Cursor/Claude generate 85–90 % of application code from structured specs with minimal hallucination.

**Status:** All backend nodes wired, frontend UI connected, Prisma schema extended, and extractor tests (8/8) passing.

---

## 1. Database (Prisma) — Additive Only

### Schema change
- Added model `StageDerivedSpec` to `packages/database/schema.prisma` with fields:
  - `id`, `stageId` (unique FK), `typesJson`, `operationsJson`, `tasksJson`, `tasksAuditScore`, `inferenceRulesApplied`, `createdAt`, `updatedAt`
- Added inverse relation `Stage.derivedSpec`

### Migration
- `packages/database/prisma/migrations/20260714_add_stage_derived_spec/migration.sql`
- Prisma Client regenerated via `npx prisma generate --schema=packages/database/schema.prisma` (Docker-less environment → manual SQL + generate)

---

## 2. Backend — MDD LangGraph Extension

### State & schema
**Files:**
- `apps/api/src/modules/ai-analysis/state/mdd-state.schema.ts`
- `apps/api/src/modules/ai-analysis/state/mdd-state.annotation.ts`

**Changes:**
- Added lean-sdd fields with safe defaults:
  - `typesJson: z.union([z.any(), z.null()]).default(null)`
  - `operationsJson: z.union([z.any(), z.null()]).default(null)`
  - `tasksJson: z.union([z.any(), z.null()]).default(null)`
  - `tasksAuditScore: z.number().default(0)`
  - `inferenceRulesApplied: z.array(z.string()).default([])`

### New pipeline nodes
**Files:**
- `apps/api/src/modules/ai-analysis/nodes/mdd-derived-spec-generator.node.ts`
  - Parses `mddDraft.typesJson` / `operationsJson` from the LLM output and materializes them into graph state.
- `apps/api/src/modules/ai-analysis/nodes/mdd-task-generator-v2.node.ts`
  - Runs the inference engine over extracted entities to produce a deterministic v2 `tasks.json`.
- `apps/api/src/modules/ai-analysis/nodes/mdd-task-auditor.node.ts`
  - Scores task quality 0–100 using the task-auditor logic; never blocks the graph.

### Graph wiring
**File:** `apps/api/src/modules/ai-analysis/graph/mdd-graph.ts`
- Inserted the 3 nodes between `prepare_output` and `graph_populator`:
  ```
  prepare_output → derived_spec_generator → task_generator_v2 → task_auditor → graph_populator
  ```

### Service integrations
**File:** `apps/api/src/modules/ai-analysis/ai-analysis.service.ts`
- Added `persistDerivedSpecs(state, projectId, stageId)` method that upserts `StageDerivedSpec` at the end of every MDD pipeline run.

**File:** `apps/api/src/modules/projects/sdd-integration.service.ts`
- `buildBundleForProject()` now delegates to `buildSpecKitBundleFilesV2`, injecting `typesJsonContent`, `operationsJsonContent`, `tasksJsonContent` and auto-generating `.cursorrules`.

**File:** `apps/api/src/modules/projects/projects.service.ts`
- `assertProjectAccess` loads stages with `include: { derivedSpec: true, estimation: true }` so downstream code can reach the generated artifacts.

**Files:**
- `apps/api/src/modules/projects/project-merge.service.ts`
- `apps/api/src/modules/projects/project-clone.util.ts`
- Updated `StageWithEst` type to include `derivedSpec`.

**File:** `apps/api/src/modules/projects/spec-kit-bundle-v2.ts`
- Already existed; now connected via `sdd-integration.service.ts`.

---

## 3. Backend — MDD Extractors (Tested)

**Goal:** Parse human/LLM-written markdown tables from MDD §3 and §4 into deterministic JSON outputs.

### `types-extractor.ts`
**File:** `apps/api/src/modules/engine/mdd-extractors/types-extractor.ts`
- Replaced brittle regex-based table parser with a line-based markdown-table splitter that:
  - Detects header row, separator (`|---|---|---|`), and body rows robustly.
  - Supports multi-row tables correctly.
- Added **implicit enum inference**: if a `varchar` field description contains a short comma-separated list of values (e.g. `user, admin, moderator`), it is treated as an enum.
- Fixed `extractRelationsFromBlock` to capture relation patterns like `hasMany(Project)` using `matchAll`.
- Fixed capitalization of inferred relation targets (e.g. `userId` → target `User`).

### `operations-extractor.ts`
**File:** `apps/api/src/modules/engine/mdd-extractors/operations-extractor.ts`
- Replaced regex table parser with line-based splitter.
- Added **soft-delete inference** from route descriptions containing "soft" or "lógico".
- Added **read-only / write-only filtering** for explicit routes: if `opType === "read-only"`, non-GET routes are dropped.
- Added **list-route enrichment**: every `list` route gets:
  - `pagination: { type: "cursor", pageSize: 20 }`
  - `searchable` / `sortable` inferred from entity fields.

### Tests
**File:** `apps/api/src/modules/engine/mdd-extractors/mdd-extractors.spec.ts`
- Fixed import paths for extractors.
- **Result:** 8/8 passing.

---

## 4. Frontend — Workshop UI

### State layer
**File:** `apps/web/src/store/workshopStore.ts`
- Added `typesContent` and `operationsContent` state fields.
- Populates them from `activeStage.derivedSpec` when available.

### Navigation/tab layer
**File:** `apps/web/src/utils/workshopDocNav.ts`
- Added nav items `types` (icon `FileCode`) and `operations` (icon `GitBranch`).

**File:** `apps/web/src/utils/complexityTabs.ts`
- Extended `WorkshopDocTab` union with `"types"` and `"operations"`.
- Updated visibility rules for the new panels.

### Components
**File:** `apps/web/src/components/JsonDocPanel.tsx`
- New read-only JSON viewer with:
  - Syntax-highlighted pretty-print
  - Copy-to-clipboard button
  - Empty-state fallback

### Views
**File:** `apps/web/src/views/WorkshopView.tsx`
- Imported `<JsonDocPanel/>`.
- Added conditional rendering for `centralPanel === "types"` and `centralPanel === "operations"`.

**File:** `apps/web/src/components/DashboardSidebar.tsx`
- Wired new state fields into nav context and memo dependencies.

---

## 5. Prompts & Docs

### Prompts
- `apps/api/src/modules/ai/prompts/data-architect-prompt.md` — MDD §3 prompt
- `apps/api/src/modules/ai/prompts/api-architect-prompt.md` — MDD §4 prompt
- `apps/api/src/modules/ai/prompts/flow-architect-prompt.md` — MDD §5 prompt

### Documentation
- `docs/LEAN-SDD-INTEGRATION-GUIDE.md` updated:
  - Marked Phase 5 (LangGraph + Frontend + Backend wiring) and Phase 6 (Spec-kit v2 export) as **Completed**.

---

## 6. Cleanup & Misc

- Removed temporary debug scripts from `apps/api/`:
  - `debug-extractor.ts`
  - `debug-extractor2.ts`
  - `debug-extractor3.ts`
  - `debug-table.ts`
  - `debug-regex.ts`
  - `debug-regex2.ts`

---

## Inference Patterns Supported (10)

| Pattern | Description |
|---|---|
| `crud-auto` | Basic CRUD routes auto-generated per entity |
| `soft-delete` | Inferred when `deletedAt` field is nullable |
| `pagination-default` | Cursor pagination for all list routes |
| `rbac-auto` | Default roles extracted from auth column |
| `zod-auto` | Zod schemas deduced from SQL types and constraints |
| `audit-auto` | Audit flag when `createdAt`/`updatedBy` exist |
| `search-auto` | Searchable fields auto-tagged (`email`, `name`, etc.) |
| `frontend-auto` | Admin/public page scaffolding from route metadata |
| `react-query` | Default state management hint |
| `react-hook-form` | Default form library hint |

---

## Checklist

- [x] Prisma schema extended (`StageDerivedSpec`)
- [x] Prisma Client regenerated
- [x] LangGraph state extended with lean-sdd fields
- [x] 3 post-audit nodes created and wired
- [x] `persistDerivedSpecs()` implemented
- [x] Extractor parsers fixed (line-based table parser)
- [x] Extractor tests passing (8/8)
- [x] Spec-kit v2 integration (`types.json`, `operations.json`, `tasks.json`, `.cursorrules`)
- [x] Frontend Workshop shows Types & Operations JSON panels
- [x] `LEAN-SDD-INTEGRATION-GUIDE.md` updated
- [x] Debug artifacts cleaned

---

*File generated on 2026-07-14 after completing Lean-SDD integration phase.*
