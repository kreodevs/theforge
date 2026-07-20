# The Forge — Paquete SDD (documentación only, 2026-07-16)

Orden de lectura recomendado para consumir este ZIP (cuaderno NotebookLM, onboarding o agentes IDE).

Este paquete contiene **solo markdown de producto y SDD**. No incluye código fuente (`apps/`, `packages/`).

## 1. Visión y arquitectura

1. **docs/notebooklm/THEFORGE-INDEX.md** — índice único: flujo, MDD lean, Quality Gate, tiers BYOK, cola MDD, merge/grupos.
2. **docs/notebooklm/THEFORGE-QUE-HACE-EL-PROYECTO.md** — qué hace el producto; módulos API; v1.
3. **blueprint.md** — implementación técnica monorepo (referencia; no incluye árbol de código).
4. **mdd.md** — MDD constitución del producto TheForge (wizard de patrones).

## 2. Pipeline MDD y validación SDD

5. **docs/notebooklm/mdd-lean-migration.md** — pipeline lean, Quality Gate vs Semáforo.
6. **docs/notebooklm/ENTREGABLES-SDD-VALIDACION.md** — estructura canónica 7 §, mapeo SDD.
7. **docs/notebooklm/MDD-PATRONES-FLUJO.md** — obsoleto; usar mdd-lean-migration.
8. **docs/notebooklm/ai-agents-dbga.md** — Fase 0 / DBGA implementado.

## 3. Workshop (usuario)

9. **docs/workshop/workshop-manual.md** — manual Workshop (spec-kit, stamps, Excalidraw, cascada, Detener MDD).
10. **docs/workshop/generacion-en-segundo-plano.md** — cola BullMQ, cancel cooperativo.
11. **docs/notebooklm/ui-spec.md** — UX tres columnas, BYOK, tiers.

## 4. Legacy, MCP e integración

12. **docs/notebooklm/LEGACY-FLOW-AS-IS-MDD.md** — flujo legacy etapa 1 AS-IS.
13. **docs/notebooklm/integracion-theforge/README.md** — cliente AriadneSpecs.
14. **docs/notebooklm/THEFORGE-MCP-SERVER.md** — MCP propio `@theforge/mcp-server`.

## 5. Release, plugins y consumo

15. **docs/THE-FORGE-V1-RELEASE.md** — release v1.0.0.
16. **docs/PLUGINS.md** — sistema de plugins.
17. **docs/ARCHITECTURE_PLUGINS.md** — arquitectura de plugins.
18. **docs/THEFORGE-DOC-CONSUMPTION-GUIDE.md** — cómo consumir la documentación.
19. **docs/speckit-vs-theforge.md** — comparativa Spec Kit.
20. **docs/TASKS-ROL-EN-SDD.md** — rol de Tasks en SDD.
21. **docs/README.md** — índice del árbol `docs/` en el repositorio.

## 6. Auditoría documental

22. **docs/DOC-GAP-REPORT.md** — brechas cerradas y residual.

---

*The Forge — Kreo — sync 2026-07-16 — docs-only*
