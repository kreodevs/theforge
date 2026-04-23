-- Gate BRD/To-Be por proyecto (usuario), no por variable de entorno.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "requireBrdTobeGate" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Project" SET "requireBrdTobeGate" = false WHERE "projectType" = 'LEGACY';
