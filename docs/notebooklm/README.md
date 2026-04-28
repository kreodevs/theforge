# NotebookLM — corpus The Forge

Material **curado para cargar en NotebookLM** (o cualquier RAG): arquitectura, SDD, MCP cliente, despliegue, seguridad y planes de producto vigentes. **No sustituye al código**; enlaces a `apps/`, `packages/` y a la raíz del monorepo (`blueprint.md`, `mdd.md`) usan rutas relativas `../../` desde esta carpeta.

## Orden sugerido al crear el cuaderno

1. **THEFORGE-INDEX.md** — visión única: flujo, IA agnóstica, semáforo, estimación MXN, Docker, Prisma.
2. **STAGE-SDD.md** — etapa vs proyecto, API aplanada, Falkor SDD.
3. **THEFORGE-QUE-HACE-EL-PROYECTO.md** — módulos API y flujos NEW vs LEGACY.
4. **ENTREGABLES-SDD-VALIDACION.md** — MDD canónico y validación.
5. **MCP-ARQUITECTURA-THEFORGE.md** + carpeta **integracion-theforge/** — AriadneSpecs HTTP vs Falkor SDD local.
6. **THEFORGE-MCP-SERVER.md** — MCP **propio** del monorepo (`@theforge/mcp-server`): herramientas sobre la API Nest (proyectos, entregables, orquestador, legacy); distinto del oráculo Ariadne.
7. **THEFORGE-MCP.md**, **LEGACY-EVIDENCE-CONTEXT.md** — doc con AriadneSpecs + contexto evidencia legacy.
8. **DEPLOY-DOCKER-NETWORK-POOLS.md**, **SECURITY-REVIEW.md**, **APRENDIZAJES.md**.
9. Resto según interés: DBGA (**ai-agents-dbga.md**), UX (**ui-spec.md**, **stitch-master-prompt.md**), negocio (**THEFORGE-DOCUMENTACION-ESTRATEGICA.md**), planes (**PLAN-*.md**).

## Sincronización con NotebookLM

Cuaderno canónico: **«The Forge - by Kreo»**. Tras editar estos `.md`, volver a subir fuentes (texto) con títulos únicos tipo `docs/notebooklm/…` para no chocar con **README** duplicados entre raíz y `integracion-theforge/`. Borrar primero las fuentes obsoletas del mismo set evita duplicados en el cuaderno.

## Fuera de este corpus

- **Histórico / aspiracional:** [../archive/README.md](../archive/README.md).
- **Índice del repo `docs/`:** [../README.md](../README.md).

---

*Corpus «The Forge - by Kreo» — NotebookLM sync 2026-04-28. Rutas relativas al monorepo `theforge`.*
