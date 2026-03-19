-- Schema base: Project, Session, Estimation, ArchitecturalPreference.
-- Requerido para BD creadas desde cero (sin db push previo).
-- Las migraciones 20250311* asumen que Project ya existe.
-- Si la BD fue creada con db push y ya tiene Project, ejecutar:
--   prisma migrate resolve --applied 20250309000000_initial_schema

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Status') THEN
    CREATE TYPE "Status" AS ENUM ('ROJO', 'AMARILLO', 'VERDE');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasUxTeam" BOOLEAN NOT NULL DEFAULT false,
    "figmaMapping" JSONB,
    "dbgaContent" TEXT,
    "specContent" TEXT,
    "architectureContent" TEXT,
    "useCasesContent" TEXT,
    "userStoriesContent" TEXT,
    "blueprintContent" TEXT,
    "tasksContent" TEXT,
    "apiContractsContent" TEXT,
    "logicFlowsContent" TEXT,
    "infraContent" TEXT,
    "uxUiGuideContent" TEXT,
    "phase0SummaryContent" TEXT,
    "mddContent" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ROJO',
    "precisionScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chatLog" JSONB NOT NULL,
    "contextStep" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Estimation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "totalMxn" DOUBLE PRECISION NOT NULL,
    "teamStructure" JSONB NOT NULL,

    CONSTRAINT "Estimation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ArchitecturalPreference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchitecturalPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotente por si la tabla ya existía)
CREATE UNIQUE INDEX IF NOT EXISTS "Estimation_projectId_key" ON "Estimation"("projectId");

-- AddForeignKey (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_projectId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Estimation_projectId_fkey') THEN
    ALTER TABLE "Estimation" ADD CONSTRAINT "Estimation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
