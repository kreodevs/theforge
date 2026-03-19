# docs

Documentación de arquitectura y operación de MaxPrime. **Entrada recomendada:** [MAXPRIME-INDEX.md](MAXPRIME-INDEX.md).

## Índice principal

| Documento | Uso |
|-----------|-----|
| [MAXPRIME-INDEX.md](MAXPRIME-INDEX.md) | Flujo producto, IA agnóstica, semáforo, estimación MXN, Docker/Dokploy, Prisma, checklist. |
| [STAGE-SDD.md](STAGE-SDD.md) | **Stage** vs **Project**: MDD/semáforo/estimación por etapa, API aplanada, enlace a Falkor SDD (diagrama ER). |
| [WORKSHOP-STAGES-IMPLEMENTATION-PLAN.md](WORKSHOP-STAGES-IMPLEMENTATION-PLAN.md) | Plan **front + API**: selector de etapa, nueva etapa, clonado MDD; brechas (estimación, orquestador, chat). |
| [MAXPRIME-QUE-HACE-EL-PROYECTO.md](MAXPRIME-QUE-HACE-EL-PROYECTO.md) | Detalle técnico: módulos API, flujos nuevo vs legacy, Relic, entregables. |
| [MCP-ARQUITECTURA-MAXPRIME.md](MCP-ARQUITECTURA-MAXPRIME.md) | Relic MCP (HTTP) vs Falkor SDD local (topología Stage / DB_Entity / API_Endpoint) vs MCP propio hipotético. |
| [ENTREGABLES-SDD-VALIDACION.md](ENTREGABLES-SDD-VALIDACION.md) | SDD, conformance, orden de generación en UI. |
| [RELIC-MAXPRIME.md](RELIC-MAXPRIME.md) | Uso de Relic desde **Cursor** (MCP FalkorSpecs) para doc de cambios. |
| [APRENDIZAJES.md](APRENDIZAJES.md) | Errores, pivotes, referencias para el equipo. |
| [MAXPRIME-DOCUMENTACION-ESTRATEGICA.md](MAXPRIME-DOCUMENTACION-ESTRATEGICA.md) | Tesis de valor / negocio (no técnico). |

## Carpetas

| Carpeta | Uso |
|---------|-----|
| [integración relic/](integración%20relic/README.md) | Contrato HTTP con Relic, herramientas MCP, planes de integración web. |
| [archive/](archive/README.md) | Roadmaps y análisis históricos (no sustituyen al código). |

## Planes y especificaciones sueltas

| Archivo | Nota |
|---------|------|
| [PLAN-FASE0-SCRAPING-DEEP-RESEARCH.md](PLAN-FASE0-SCRAPING-DEEP-RESEARCH.md) | Paso 0: URLs, scraping, deep research. |
| [PLAN-MDD-ARQUITECTO-NO-ACTUALIZA-MODELO.md](PLAN-MDD-ARQUITECTO-NO-ACTUALIZA-MODELO.md) | Post-mortem §3 / merge estructurado (estado: implementado P0–P4). |
| [MDD-PATRONES-FLUJO.md](MDD-PATRONES-FLUJO.md) | Patrones Manager, delegación, §6/§7. |
| [ui-spec.md](ui-spec.md) | Especificación UI Workshop (referencia). |
| [generator-workflow.md](generator-workflow.md) | Filosofía Constitution / loop interactivo (inglés). |
| [ai-agents-dbga.md](ai-agents-dbga.md) | Agentes benchmark / DBGA. |
| [DEPLOY-DOCKER-NETWORK-POOLS.md](DEPLOY-DOCKER-NETWORK-POOLS.md) | Redes Docker / Dokploy. |

Fuentes de producto en la raíz del repo: `blueprint.md`, `mdd.md`.
