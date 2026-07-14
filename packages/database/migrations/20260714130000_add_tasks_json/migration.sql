-- Tasks estructurado v2 (JSON parseado desde tasksContent): dependencias, targetFiles, inferenceRules, etc.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "tasksJson" JSONB;

ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "tasksJson" JSONB;
