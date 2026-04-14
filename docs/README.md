# docs

Documentación de arquitectura y operación de TheForge. **Entrada recomendada:** [THEFORGE-INDEX.md](THEFORGE-INDEX.md).

## Índice principal

| Documento | Uso |
|-----------|-----|
| [THEFORGE-INDEX.md](THEFORGE-INDEX.md) | Flujo producto, IA agnóstica, semáforo, estimación MXN, Docker/Dokploy, Prisma, checklist. |
| [STAGE-SDD.md](STAGE-SDD.md) | **Stage** vs **Project**: MDD/semáforo/estimación por etapa, API aplanada, enlace a Falkor SDD (diagrama ER). |
| [WORKSHOP-STAGES-IMPLEMENTATION-PLAN.md](WORKSHOP-STAGES-IMPLEMENTATION-PLAN.md) | Plan **front + API**: selector de etapa, nueva etapa, clonado MDD; brechas (estimación, orquestador, chat). |
| [THEFORGE-QUE-HACE-EL-PROYECTO.md](THEFORGE-QUE-HACE-EL-PROYECTO.md) | Detalle técnico: módulos API, flujos nuevo vs legacy, Relic, entregables. |
| [MCP-ARQUITECTURA-THEFORGE.md](MCP-ARQUITECTURA-THEFORGE.md) | MCP **AriadneSpecs** (HTTP, código indexado) vs Falkor SDD local vs MCP propio hipotético. Especificación servidor: monorepo Ariadne (`MCP_HTTPS.md`, `mcp_server_specs.md`). |
| [ENTREGABLES-SDD-VALIDACION.md](ENTREGABLES-SDD-VALIDACION.md) | SDD, conformance, orden de generación en UI. |
| [THEFORGE-MCP.md](THEFORGE-MCP.md) | Uso del MCP AriadneSpecs desde **Cursor** para doc de cambios en repos indexados. |
| [APRENDIZAJES.md](APRENDIZAJES.md) | Errores, pivotes, referencias para el equipo. |
| [THEFORGE-DOCUMENTACION-ESTRATEGICA.md](THEFORGE-DOCUMENTACION-ESTRATEGICA.md) | Tesis de valor / negocio (no técnico). |

## Carpetas

| Carpeta | Uso |
|---------|-----|
| [integración theforge/](integración%20theforge/README.md) | Cliente HTTP The Forge ↔ MCP AriadneSpecs (alineado a `MCP_HTTPS.md` / SPEC-MCP-001 en repo Ariadne). |
| [archive/](archive/README.md) | Roadmaps y análisis históricos (no sustituyen al código). |

## Planes y especificaciones sueltas

| Archivo | Nota |
|---------|------|
| [PLAN-FASE0-SCRAPING-DEEP-RESEARCH.md](PLAN-FASE0-SCRAPING-DEEP-RESEARCH.md) | Paso 0: URLs, scraping, deep research. |
| [PLAN-MDD-ARQUITECTO-NO-ACTUALIZA-MODELO.md](PLAN-MDD-ARQUITECTO-NO-ACTUALIZA-MODELO.md) | Post-mortem §3 / merge estructurado (estado: implementado P0–P4). |
| [MDD-PATRONES-FLUJO.md](MDD-PATRONES-FLUJO.md) | Patrones Manager, delegación, §6/§7. |
| [ui-spec.md](ui-spec.md) | Especificación UI Workshop (referencia). |
| [stitch-master-prompt.md](stitch-master-prompt.md) | **Prompt maestro** para Google Stitch (todas las pantallas + variantes). |
| [generator-workflow.md](generator-workflow.md) | Filosofía Constitution / loop interactivo (inglés). |
| [ai-agents-dbga.md](ai-agents-dbga.md) | Agentes benchmark / DBGA. |
| [DEPLOY-DOCKER-NETWORK-POOLS.md](DEPLOY-DOCKER-NETWORK-POOLS.md) | Redes Docker / Dokploy. |

Fuentes de producto en la raíz del repo: `blueprint.md`, `mdd.md`.
