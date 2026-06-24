-- Documentation gap multi-agent: gaps reportados por MCP + timeline de sesión agéntica

CREATE TYPE "DocumentationGapStatus" AS ENUM ('OPEN', 'QUEUED', 'RECONCILING', 'RESOLVED', 'REJECTED', 'DUPLICATE');

CREATE TYPE "AgentSessionLogKind" AS ENUM ('GAP_REPORTED', 'RECONCILE_QUEUED', 'ARTIFACT_UPDATED', 'RECONCILE_REJECTED');

CREATE TABLE IF NOT EXISTS "DocumentationGap" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "status" "DocumentationGapStatus" NOT NULL DEFAULT 'OPEN',
  "affectedArtifacts" JSONB NOT NULL,
  "description" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "dedupHash" TEXT NOT NULL,
  "jobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "DocumentationGap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentSessionLog" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "kind" "AgentSessionLogKind" NOT NULL,
  "gapId" TEXT,
  "summary" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSessionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentationGap_projectId_createdAt_idx" ON "DocumentationGap"("projectId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentationGap_stageId_createdAt_idx" ON "DocumentationGap"("stageId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentationGap_dedupHash_createdAt_idx" ON "DocumentationGap"("dedupHash", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DocumentationGap_status_idx" ON "DocumentationGap"("status");

CREATE INDEX IF NOT EXISTS "AgentSessionLog_projectId_stageId_createdAt_idx" ON "AgentSessionLog"("projectId", "stageId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AgentSessionLog_gapId_idx" ON "AgentSessionLog"("gapId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentationGap_stageId_fkey') THEN
    ALTER TABLE "DocumentationGap"
      ADD CONSTRAINT "DocumentationGap_stageId_fkey"
      FOREIGN KEY ("stageId") REFERENCES "Stage"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentSessionLog_stageId_fkey') THEN
    ALTER TABLE "AgentSessionLog"
      ADD CONSTRAINT "AgentSessionLog_stageId_fkey"
      FOREIGN KEY ("stageId") REFERENCES "Stage"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentSessionLog_gapId_fkey') THEN
    ALTER TABLE "AgentSessionLog"
      ADD CONSTRAINT "AgentSessionLog_gapId_fkey"
      FOREIGN KEY ("gapId") REFERENCES "DocumentationGap"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
