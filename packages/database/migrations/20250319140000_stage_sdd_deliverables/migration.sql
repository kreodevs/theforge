-- Stage: workflowStatus (antes "status" StageStatus) + MDD, semáforo SDD y estimación por etapa.
-- Proyecto deja de ser monolito SDD: se eliminan mddContent, status, precisionScore de Project.

-- Enum semáforo SDD. No estaba en migraciones SQL anteriores (suele existir por db push / baseline); sin esto falla:
--   ERROR: type "Status" does not exist (ADD COLUMN "status" "Status" en Stage).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Status') THEN
    CREATE TYPE "Status" AS ENUM ('ROJO', 'AMARILLO', 'VERDE');
  END IF;
END
$$;

-- Etapa por defecto para proyectos sin fila en Stage (datos previos a agent_memory_stages).
INSERT INTO "Stage" ("id", "projectId", "ordinal", "key", "name", "status", "isLegacy", "relicProjectId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p."id",
  1,
  'main',
  'Etapa principal',
  'ACTIVE'::"StageStatus",
  (p."projectType" = 'LEGACY'),
  p."relicProjectId",
  NOW(),
  NOW()
FROM "Project" p
WHERE NOT EXISTS (SELECT 1 FROM "Stage" s WHERE s."projectId" = p."id");

-- Renombrar columna de workflow para liberar el nombre "status" al semáforo SDD (enum Status).
ALTER TABLE "Stage" RENAME COLUMN "status" TO "workflowStatus";

-- Nuevas columnas SDD en Stage
ALTER TABLE "Stage" ADD COLUMN "mddContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN "precisionScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Stage" ADD COLUMN "status" "Status" NOT NULL DEFAULT 'ROJO';

-- Copiar MDD y semáforo desde Project → primera etapa de cada proyecto
UPDATE "Stage" s
SET
  "mddContent" = p."mddContent",
  "status" = p."status",
  "precisionScore" = p."precisionScore"
FROM "Project" p
WHERE s."projectId" = p."id"
  AND s."id" = (
    SELECT s2."id" FROM "Stage" s2
    WHERE s2."projectId" = p."id"
    ORDER BY s2."ordinal" ASC
    LIMIT 1
  );

-- Estimation: FK de Project → Stage
ALTER TABLE "Estimation" ADD COLUMN "stageId" TEXT;

UPDATE "Estimation" e
SET "stageId" = (
  SELECT s."id" FROM "Stage" s
  WHERE s."projectId" = e."projectId"
  ORDER BY s."ordinal" ASC
  LIMIT 1
);

-- FK y UNIQUE sobre projectId: nombres varían (Prisma migrate vs db push / versiones).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE rel.relname = 'Estimation'
      AND c.contype = 'f'
      AND ref.relname = 'Project'
  ) LOOP
    EXECUTE format('ALTER TABLE "Estimation" DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = '"Estimation"'::regclass
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND (
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      ) = 'projectId'
  ) LOOP
    EXECUTE format('ALTER TABLE "Estimation" DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

-- Unicidad solo como índice (sin constraint con nombre Prisma)
DROP INDEX IF EXISTS "Estimation_projectId_key";
DROP INDEX IF EXISTS "Estimation_projectId_unique";

ALTER TABLE "Estimation" DROP COLUMN "projectId";
ALTER TABLE "Estimation" ALTER COLUMN "stageId" SET NOT NULL;

CREATE UNIQUE INDEX "Estimation_stageId_key" ON "Estimation"("stageId");

ALTER TABLE "Estimation" ADD CONSTRAINT "Estimation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quitar columnas SDD del proyecto
ALTER TABLE "Project" DROP COLUMN "mddContent";
ALTER TABLE "Project" DROP COLUMN "status";
ALTER TABLE "Project" DROP COLUMN "precisionScore";
