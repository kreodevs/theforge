# docs

Punto de entrada para humanos y agentes. **Arquitectura y producto (NotebookLM):** carpeta **[notebooklm/](notebooklm/README.md)** — ahí vive el índice principal, SDD, MCP, despliegue y planes vigentes.

## Enlaces rápidos

| Necesitas… | Documento |
|------------|-------------|
| Release v1 — generación v2, Excalidraw híbrido, formateador Markdown | [THE-FORGE-V1-RELEASE.md](THE-FORGE-V1-RELEASE.md) |
| Comparativa spec-kit vs The Forge (SDD, gaps, alineación) | [speckit-vs-theforge.md](speckit-vs-theforge.md) |
| Agente IA implementando desde docs TheForge | [THEFORGE-DOC-CONSUMPTION-GUIDE.md](THEFORGE-DOC-CONSUMPTION-GUIDE.md) |
| MCP gráfico (componentes UI, Kreo, Pantallas) | [MCP_GRAFICO.md](MCP_GRAFICO.md) |
| Visión técnica única (flujo, semáforo, costos, Docker) | [notebooklm/THEFORGE-INDEX.md](notebooklm/THEFORGE-INDEX.md) |
| Etapas `Stage`, API aplanada, Falkor | [notebooklm/STAGE-SDD.md](notebooklm/STAGE-SDD.md) |
| Legacy etapa 1 AS-IS (MDD Inicial → MDD) | [notebooklm/LEGACY-FLOW-AS-IS-MDD.md](notebooklm/LEGACY-FLOW-AS-IS-MDD.md) |
| Integración legacy ↔ nuevo (guía de usuario) | [notebooklm/LEGACY-NEW-INTEGRATION-GUIDE.md](notebooklm/LEGACY-NEW-INTEGRATION-GUIDE.md) |
| Planes de implementación (índice) | [plans/README.md](plans/README.md) |
| Cliente HTTP The Forge ↔ MCP AriadneSpecs | [notebooklm/integracion-theforge/README.md](notebooklm/integracion-theforge/README.md) |
| Despliegue Coolify (override compose) | [DEPLOY-COOLIFY.md](DEPLOY-COOLIFY.md) |
| Histórico / roadmaps no prioritarios | [archive/README.md](archive/README.md) |

## Raíz del monorepo (no están en `docs/`)

- `blueprint.md`, `mdd.md` — especificación de producto viva. Actualizadas a v2.0 (mayo 2026).

## Limpieza reciente (2026-04)

Se **eliminaron** planes ya cubiertos por el código o duplicados: post-mortem §3 implementado, notas sueltas Ariadne+Forge, plan de etapas Workshop desactualizado, plan web TheForge-Web (la integración vive en `apps/api` + `apps/web`). El detalle operativo sigue en **notebooklm** e **archive**.
