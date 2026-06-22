# Plan: spec-kit alignment roadmap

**Status:** Implemented (2026-06-19)  
**Scope:** The Forge monorepo — close repo-native last mile vs [github/spec-kit](https://github.com/github/spec-kit).

## Summary

| Feature | Commit style (reference) | Status |
|---------|------------------------|--------|
| Post-VERDE wizard «Llevar al repo» | `feat(web): repo handoff wizard after green semaphore` | ✅ |
| Tasks v2 (spec-kit format) | `feat(api): spec-kit tasks prompt and parser` | ✅ |
| Clarify pre-MDD | `feat(api): POST clarify-spec before MDD pipeline` | ✅ |
| Analyze dashboard | `feat(api): unified SDD analyze report` | ✅ |
| MCP implement hint | `feat(mcp): get_next_implementation_task tool` | ✅ |

## 1. Llevar al repo (post-VERDE)

- **API:** `GET /projects/:id/export/repo-handoff` — spec-kit files + agent governance scaffold.
- **Web:** `LlevarAlRepoWizardDialog` — button in semáforo column when VERDE; ZIP via `downloadRepoHandoffFromApi`.
- **CLI:** `scripts/theforge-export.mjs` — writes `specs/`, `.specify/`, `agent-governance/` to `--out`.
- **Bundle:** Enhanced `IMPLEMENT.md` in `packages/shared-types/src/spec-kit-bundle.ts`.

## 2. Tasks v2

- **Prompt:** `apps/api/src/modules/ai/prompts/tasks-prompt.md` — user stories, `[P]`, file paths, checkpoints.
- **Parser:** `packages/shared-types/src/tasks-parse.ts` — `parallel`, `filePaths`, `checkpoint`, `getNextOpenTask`.
- **Integrations:** `converge` and `tasks-to-issues` use `cleanTitle` and file path metadata.

## 3. Clarify pre-MDD

- **API:** `POST /projects/:id/clarify-spec` — `{ persist?, notes? }`; uses `clarify-spec-prompt.md`.
- **Web:** `ClarifySpecPanel` in Spec toolbar (Aclarar).

## 4. Analyze dashboard

- **API:** `GET /projects/:id/analyze` — `SddAnalyzeReport` (conformance + cross-artifact gaps + tasks stats).
- **Web:** `AnalyzeDashboard` in metrics column («Analizar consistencia SDD»).

## 5. MCP implement (lightweight)

- **API:** `GET /projects/:id/next-task`
- **MCP:** `get_next_implementation_task` → documented in `packages/mcp-server/README.md`

## Verification

```bash
pnpm --filter @theforge/shared-types run test:types
pnpm --filter @theforge/api exec node --import tsx --test src/modules/projects/spec-kit-bundle.spec.ts
```

## Follow-ups (out of scope)

- Reconciled agent-governance export in repo-handoff (today uses raw scaffold; full reconcile via `getAgentGovernanceForExport` optional).
- `quickstart.md` auto-generation from acceptance tests.
- Auto-open wizard on first VERDE transition.
