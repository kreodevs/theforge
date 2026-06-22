-- Migration: add_stage_deliverable_columns
-- Live SDD deliverables per stage + backfill baseline stage from Project flat fields.

ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "specContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "architectureContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "useCasesContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "userStoriesContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "blueprintContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "tasksContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "apiContractsContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "logicFlowsContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "infraContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "agentGovernanceContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "uxUiGuideContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "phase0SummaryContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "aemContent" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "convergeWebhookUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "convergeWebhookSecret" TEXT;

-- Backfill stage 1 (min ordinal) from project deliverables when stage columns are empty.
UPDATE "Stage" s
SET
  "specContent" = COALESCE(NULLIF(TRIM(s."specContent"), ''), p."specContent"),
  "architectureContent" = COALESCE(NULLIF(TRIM(s."architectureContent"), ''), p."architectureContent"),
  "useCasesContent" = COALESCE(NULLIF(TRIM(s."useCasesContent"), ''), p."useCasesContent"),
  "userStoriesContent" = COALESCE(NULLIF(TRIM(s."userStoriesContent"), ''), p."userStoriesContent"),
  "blueprintContent" = COALESCE(NULLIF(TRIM(s."blueprintContent"), ''), p."blueprintContent"),
  "tasksContent" = COALESCE(NULLIF(TRIM(s."tasksContent"), ''), p."tasksContent"),
  "apiContractsContent" = COALESCE(NULLIF(TRIM(s."apiContractsContent"), ''), p."apiContractsContent"),
  "logicFlowsContent" = COALESCE(NULLIF(TRIM(s."logicFlowsContent"), ''), p."logicFlowsContent"),
  "infraContent" = COALESCE(NULLIF(TRIM(s."infraContent"), ''), p."infraContent"),
  "agentGovernanceContent" = COALESCE(NULLIF(TRIM(s."agentGovernanceContent"), ''), p."agentGovernanceContent"),
  "uxUiGuideContent" = COALESCE(NULLIF(TRIM(s."uxUiGuideContent"), ''), p."uxUiGuideContent"),
  "phase0SummaryContent" = COALESCE(NULLIF(TRIM(s."phase0SummaryContent"), ''), p."phase0SummaryContent"),
  "aemContent" = COALESCE(NULLIF(TRIM(s."aemContent"), ''), p."aemContent")
FROM "Project" p
WHERE s."projectId" = p.id
  AND s."ordinal" = (
    SELECT MIN(s2."ordinal")
    FROM "Stage" s2
    WHERE s2."projectId" = p.id
  );
