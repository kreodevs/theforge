# @theforge/api

Backend NestJS de TheForge.

- **Módulos:** Projects (incluye `POST/PATCH …/projects/:id/stages`, **`POST …/generate-deliverables`** cascada por `complexity`, y MDD por etapa con `stageId` en PATCH), Sessions, AI (adapters OpenAI/Gemini), Engine (cost-calculator, semáforo). **Ai-orchestrator:** `POST /ai-orchestrator/welcome` acepta `stageId` opcional (contexto MDD alineado a la etapa). **Ai-analysis:** checkpoints LangGraph / `mdd/thread` por `projectId` + `mddStageId`.
- **DB:** Prisma + PostgreSQL (schema en `packages/database`).
- **IA:** `AI_PROVIDER=openai|google`; factory inyecta el adapter.

Env: `DATABASE_URL`, `AI_PROVIDER`, `OPENAI_API_KEY` o `GOOGLE_GENERATIVE_AI_API_KEY`. Proyectos **legacy** + MCP: `THEFORGE_MCP_URL`, tokens MCP; pipeline evidencia-primero y topes en variables `LEGACY_*` (ver raíz `.env.example` y `docs/LEGACY-EVIDENCE-CONTEXT.md`).

## Despliegue (Docker / Dokploy)

- **ENTRYPOINT** `docker-entrypoint.sh`: (1) espera TCP a Postgres vía `scripts/wait-for-postgres.cjs`, (2) `prisma migrate deploy` desde `packages/database`, (3) arranca Nest (`main.js`).
- En la UI de Dokploy (o cualquier plataforma), **no** sustituir el comando de arranque por `node dist/main.js` solo: se saltarían las migraciones. Usar la imagen tal cual o un comando que invoque el mismo entrypoint.
- Opcional: `WAIT_FOR_POSTGRES_ATTEMPTS` (default 90), `WAIT_FOR_POSTGRES_DELAY_MS` (default 1000).
- **P3009** (`stage_sdd_deliverables`): el entrypoint intenta `migrate resolve --rolled-back` automáticamente antes de `deploy`. Otra migración atascada: `PRISMA_RESOLVE_ROLLED_BACK` o [packages/database/README.md](../../packages/database/README.md).
