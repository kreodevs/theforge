-- Migration: add_stage_legacy_change_state
-- Fecha: 2026-05-02
-- Descripción: Agrega legacyChangeState al modelo Stage y migra datos desde Project.legacyFlowState

-- 1. Agregar columna a Stage
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "legacyChangeState" JSONB;

-- 2. Migrar datos existentes: Project.legacyFlowState → Stage.legacyChangeState
-- Para cada proyecto legacy, tomar la etapa de menor ordinal (Stage 1 / línea base)
UPDATE "Stage" s
SET "legacyChangeState" = (
  SELECT p."legacyFlowState"
  FROM "Project" p
  WHERE p.id = s."projectId"
    AND p."projectType" = 'LEGACY'
    AND p."legacyFlowState" IS NOT NULL
)
WHERE s."ordinal" = (
  SELECT MIN(s2."ordinal")
  FROM "Stage" s2
  WHERE s2."projectId" = s."projectId"
)
AND EXISTS (
  SELECT 1 FROM "Project" p
  WHERE p.id = s."projectId"
    AND p."projectType" = 'LEGACY'
    AND p."legacyFlowState" IS NOT NULL
);

-- 3. Confirmar migración (opcional: luego limpiar Project.legacyFlowState cuando el frontend esté listo)
