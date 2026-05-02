# Plan de Implementación: Etapas como Cambios Legacy

## Fase 1 — Migración Prisma: `legacyChangeState` en Stage
1. Agregar campo `legacyChangeState Json?` al modelo `Stage` en schema.prisma
2. Crear script de migración: mover `Project.legacyFlowState` → `Stage.legacyChangeState` para la etapa primaria de cada proyecto legacy
3. Actualizar `legacy-coordinator.service.ts` para leer/escribir `stage.legacyChangeState` en vez de `project.legacyFlowState`
4. Actualizar controladores y stores del frontend

## Fase 2 — FalkorDB: grafo de dependencias entre etapas
1. Al crear etapa de cambio, crear nodo `LegacyStage` en FalkorDB
2. Relación `DERIVED_FROM` con etapa base
3. Al analizar con Ariadne (`legacy/start`), crear relaciones `AFFECTS` con entidades del SDD impactadas
4. Al generar documentos, crear relaciones `CREATES` con entidades nuevas

## Fase 3 — Backend: generación por etapa
1. `generateMdd(stageId)` usa `stage.legacyChangeState.description` para bifurcar inicial vs cambio
2. `start(stageId, description)` escribe en `stage.legacyChangeState`
3. `answer(stageId, answers)` escribe en `stage.legacyChangeState`
4. Staged discovery acepta `baselineMdd` (MDD de etapa anterior)

## Fase 4 — Frontend: UI de etapas como cambios
1. Botón "+ Nueva etapa de cambio"
2. Cada etapa legacy muestra su panel de cambio propio
3. Al crear etapa, clonar `legacyChangeState` de la etapa anterior

## Fase 5 — Prompts incrementales
1. Modificar prompts para generar documentos incrementales
2. No redescribir todo el sistema en cada etapa
