-- AgentStateCheckpoint: un hilo por (projectId, mddStageId). Vacío = DBGA/Fase 0; UUID Stage = Manager MDD.
-- Si la tabla no existe (DB creada sin migración que la creó), crearla primero.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AgentStateCheckpoint') THEN
    CREATE TABLE "AgentStateCheckpoint" (
      "id" TEXT NOT NULL,
      "threadId" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "mddStageId" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "AgentStateCheckpoint_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "AgentStateCheckpoint_threadId_key" ON "AgentStateCheckpoint"("threadId");
    CREATE UNIQUE INDEX "AgentStateCheckpoint_projectId_mddStageId_key" ON "AgentStateCheckpoint"("projectId", "mddStageId");
    CREATE INDEX "AgentStateCheckpoint_projectId_idx" ON "AgentStateCheckpoint"("projectId");
    ALTER TABLE "AgentStateCheckpoint" ADD CONSTRAINT "AgentStateCheckpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ELSE
    ALTER TABLE "AgentStateCheckpoint" ADD COLUMN IF NOT EXISTS "mddStageId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "AgentStateCheckpoint" DROP CONSTRAINT IF EXISTS "AgentStateCheckpoint_projectId_key";
    DROP INDEX IF EXISTS "AgentStateCheckpoint_projectId_key";
    CREATE UNIQUE INDEX IF NOT EXISTS "AgentStateCheckpoint_projectId_mddStageId_key" ON "AgentStateCheckpoint"("projectId", "mddStageId");
    CREATE INDEX IF NOT EXISTS "AgentStateCheckpoint_projectId_idx" ON "AgentStateCheckpoint"("projectId");
  END IF;
END
$$;
