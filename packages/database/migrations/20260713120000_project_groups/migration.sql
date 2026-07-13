-- Migration: project_groups
-- Fecha: 2026-07-13
-- Descripción: Grupos de proyectos en dashboard; grupo por defecto "Proyectos".

-- 1. Tabla ProjectGroup
CREATE TABLE IF NOT EXISTS "ProjectGroup" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectGroup_slug_key" ON "ProjectGroup"("slug");
CREATE INDEX IF NOT EXISTS "ProjectGroup_sortOrder_name_idx" ON "ProjectGroup"("sortOrder", "name");

-- 2. Grupo por defecto (ID fijo para seed)
INSERT INTO "ProjectGroup" ("id", "name", "slug", "isDefault", "sortOrder", "createdAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Proyectos', 'proyectos', true, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 3. FK en Project (nullable → backfill → NOT NULL)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

UPDATE "Project"
SET "groupId" = '00000000-0000-4000-8000-000000000001'
WHERE "groupId" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "groupId" SET NOT NULL;

ALTER TABLE "Project" ADD CONSTRAINT "Project_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Project_groupId_idx" ON "Project"("groupId");
