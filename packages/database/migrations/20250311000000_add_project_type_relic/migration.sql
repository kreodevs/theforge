-- CreateEnum (idempotent: no falla si ya existe por db push o aplicación previa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectType') THEN
    CREATE TYPE "ProjectType" AS ENUM ('NEW', 'LEGACY');
  END IF;
END
$$;

-- AlterTable (idempotent: ADD COLUMN IF NOT EXISTS en PG 9.5+)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectType" "ProjectType" NOT NULL DEFAULT 'NEW';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "relicProjectId" TEXT;

-- Ajustar default si la columna existía sin NOT NULL
ALTER TABLE "Project" ALTER COLUMN "projectType" SET DEFAULT 'NEW';
