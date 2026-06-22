-- Migration: drop_project_legacy_flow_state
-- Final copy of Project.legacyFlowState → Stage.legacyChangeState, then drop column.

WITH target AS (
  SELECT DISTINCT ON (p.id)
    p.id AS project_id,
    p."legacyFlowState",
    s.id AS stage_id
  FROM "Project" p
  INNER JOIN "Stage" s ON s."projectId" = p.id
  WHERE p."legacyFlowState" IS NOT NULL
  ORDER BY
    p.id,
    CASE WHEN s."workflowStatus" = 'ACTIVE' THEN 0 ELSE 1 END,
    s."ordinal" ASC
)
UPDATE "Stage" st
SET "legacyChangeState" = CASE
  WHEN st."legacyChangeState" IS NULL THEN t."legacyFlowState"
  ELSE st."legacyChangeState" || t."legacyFlowState"
END
FROM target t
WHERE st.id = t.stage_id;

ALTER TABLE "Project" DROP COLUMN IF EXISTS "legacyFlowState";
