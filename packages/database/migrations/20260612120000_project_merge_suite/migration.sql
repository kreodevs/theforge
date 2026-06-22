-- Fusión de proyectos: archivado, linaje y suite (sub-proyectos vinculados).

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "mergedFrom" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "parentProjectId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_archivedAt_idx" ON "Project"("archivedAt");
CREATE INDEX IF NOT EXISTS "Project_parentProjectId_idx" ON "Project"("parentProjectId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_parentProjectId_fkey'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_parentProjectId_fkey"
      FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
