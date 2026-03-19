-- AgentStateCheckpoint: un hilo por (projectId, mddStageId). Vacío = DBGA/Fase 0; UUID Stage = Manager MDD.

ALTER TABLE "AgentStateCheckpoint" ADD COLUMN "mddStageId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "AgentStateCheckpoint" DROP CONSTRAINT IF EXISTS "AgentStateCheckpoint_projectId_key";

DROP INDEX IF EXISTS "AgentStateCheckpoint_projectId_key";

CREATE UNIQUE INDEX "AgentStateCheckpoint_projectId_mddStageId_key" ON "AgentStateCheckpoint"("projectId", "mddStageId");

CREATE INDEX "AgentStateCheckpoint_projectId_idx" ON "AgentStateCheckpoint"("projectId");
