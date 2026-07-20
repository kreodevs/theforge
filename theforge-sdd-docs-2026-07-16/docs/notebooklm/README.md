# NotebookLM — corpus The Forge

Material **curado para cargar en NotebookLM** (o cualquier RAG): arquitectura, SDD, MCP cliente, despliegue, seguridad y planes de producto vigentes. **No sustituye al código**; enlaces a `apps/`, `packages/` y a la raíz del monorepo (`blueprint.md`, `mdd.md`) usan rutas relativas `../../` desde esta carpeta.

## Gestor de paquetes (pnpm)

El monorepo usa **pnpm 9** (`packageManager` en `package.json` raíz, `pnpm-workspace.yaml`, lockfile `pnpm-lock.yaml`). Comandos habituales **desde la raíz** del repo:

```bash
corepack enable
pnpm install
pnpm run dev              # API + Web (Turbo)
pnpm run dev:local        # Postgres (Colima/Docker) + dev
pnpm run dev:api
pnpm run dev:web
pnpm run db:generate
pnpm run db:push
pnpm run build
pnpm run test
pnpm run test:types
pnpm --filter @theforge/api run test:mcp-alignment
```

Docker multi-stage: `corepack enable` + `pnpm install --frozen-lockfile` + `pnpm exec turbo run build` (ver `apps/api/Dockerfile`, `apps/web/Dockerfile`). No uses `npm` ni `package-lock.json` en este repo (ignorado en `.gitignore`).

## Orden sugerido al crear el cuaderno

1. **THEFORGE-INDEX.md** — visión única: flujo, IA agnóstica, semáforo, estimación MXN, Docker, Prisma.
2. **mdd-lean-migration.md** — pipeline MDD lean, Quality Gate, tiers C/B/A, cola `theforge-mdd`.
3. **STAGE-SDD.md** — etapa vs proyecto, API aplanada, Falkor SDD.
4. **THEFORGE-QUE-HACE-EL-PROYECTO.md** — módulos API y flujos NEW vs LEGACY.
5. **THE-FORGE-V1-RELEASE.md** — release v1: generación v2, Excalidraw, spec-kit, colas.
6. **PLUGINS.md** — sistema de plugins extensible.
7. **LEGACY-FLOW-AS-IS-MDD.md** — flujo legacy etapa 1 (MDD Inicial vs MDD, inyección §3–§5, entregables, troubleshooting).
8. **ENTREGABLES-SDD-VALIDACION.md** — MDD canónico y validación.
9. **MCP-ARQUITECTURA-THEFORGE.md** + carpeta **integracion-theforge/** — AriadneSpecs HTTP vs Falkor SDD local.
10. **THEFORGE-MCP-SERVER.md** — MCP **propio** del monorepo (`@theforge/mcp-server`): herramientas sobre la API Nest (proyectos, entregables, orquestador, legacy); distinto del oráculo Ariadne.
11. **THEFORGE-MCP.md**, **LEGACY-EVIDENCE-CONTEXT.md** — doc con AriadneSpecs + contexto evidencia legacy.
12. **DEPLOY-DOCKER-NETWORK-POOLS.md**, **SECURITY-REVIEW.md**, **APRENDIZAJES.md**.
13. Resto según interés: DBGA (**ai-agents-dbga.md**), UX (**ui-spec.md**, **stitch-master-prompt.md**), negocio (**THEFORGE-DOCUMENTACION-ESTRATEGICA.md**), planes (**PLAN-*.md**). **MDD-PATRONES-FLUJO.md** está obsoleto — usar **mdd-lean-migration.md**.

## Sincronización con NotebookLM

Cuaderno canónico: **«The Forge - by Kreo»**. Tras editar estos `.md`, volver a subir fuentes (texto) con títulos únicos tipo `docs/notebooklm/…` para no chocar con **README** duplicados entre raíz y `integracion-theforge/`. Borrar primero las fuentes obsoletas del mismo set evita duplicados en el cuaderno.

## Fuera de este corpus

- **Histórico / aspiracional:** [../archive/README.md](../archive/README.md).
- **Índice del repo `docs/`:** [../README.md](../README.md).

---

*Corpus «The Forge - by Kreo» — NotebookLM sync 2026-07-16 (pnpm). Rutas relativas al monorepo `theforge`.*
