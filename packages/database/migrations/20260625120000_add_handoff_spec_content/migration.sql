-- IntegrationAgent: handoff-spec.md artifact (NEW-LEG items expanded to legacy technical requirements).
-- Lives per stage (legacy integration stage 2+) and is flattened onto Project like other deliverables.
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "handoffSpecContent" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "handoffSpecContent" TEXT;
