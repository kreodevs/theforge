-- Sync drift: schema fields never captured in Prisma migrations (pluginData, DocumentSnapshot, etc.).
-- Supersedes manual 20260713143000_document_snapshots.sql (not in _prisma_migrations).
-- Idempotent: safe on prod/staging where entrypoint already ran packages/database/scripts/safe-schema-sync.sql.
-- Additive only: no DROP statements. Legacy columns (handoffSpecContent, legacyFlowState,
-- requireBrdTobeGate on Project; asIsManualContent, brdApprovedAt, handoffSpecContent,
-- toBeApprovedAt, toBeManualContent on Stage) remain in the database until a future data migration.
-- Does NOT drop LangGraph checkpoint_* tables (safe-schema-sync keeps/creates them).

-- ---------------------------------------------------------------------------
-- Project: add columns present in schema.prisma
-- ---------------------------------------------------------------------------

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "aemContent" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "convergeWebhookSecret" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "convergeWebhookUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "phase0Gaps" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "phase0Questions" INTEGER DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "phase0Status" TEXT DEFAULT 'idle';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "pluginData" JSONB;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "uxGuideDesignRef" TEXT;

-- ---------------------------------------------------------------------------
-- Stage: add columns present in schema.prisma
-- (uiScreensContent kept: still on Project in schema.prisma; safe-schema-sync may add on Stage)
-- ---------------------------------------------------------------------------

ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "aemContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "agentGovernanceContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "apiContractsContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "architectureContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "blueprintContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "changeSpecContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "deliverableSnapshot" JSONB;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "infraContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "legacyChangeState" JSONB;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "logicFlowsContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "phase0SummaryContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "specContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "tasksContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "useCasesContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "userStoriesContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "uxUiGuideContent" TEXT;

-- ---------------------------------------------------------------------------
-- User: MCP / Ariadne columns (also in safe-schema-sync)
-- ---------------------------------------------------------------------------

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mcpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ariadneMcpUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ariadneMcpToken" TEXT;

-- ---------------------------------------------------------------------------
-- Tables missing from _prisma_migrations (FavoriteProject, ChangeLog, DocumentSnapshot, AppConfig)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "FavoriteProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChangeLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentLength" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "FavoriteProject_userId_idx" ON "FavoriteProject"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FavoriteProject_userId_projectId_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'FavoriteProject_userId_projectId_key'
  ) THEN
    ALTER TABLE "FavoriteProject"
      ADD CONSTRAINT "FavoriteProject_userId_projectId_key" UNIQUE ("userId", "projectId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ChangeLog_projectId_createdAt_idx" ON "ChangeLog"("projectId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "DocumentSnapshot_projectId_field_createdAt_idx"
    ON "DocumentSnapshot"("projectId", "field", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Session_projectId_idx" ON "Session"("projectId");

CREATE UNIQUE INDEX IF NOT EXISTS "User_mcpSecret_key" ON "User"("mcpSecret");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FavoriteProject_userId_fkey'
  ) THEN
    ALTER TABLE "FavoriteProject"
      ADD CONSTRAINT "FavoriteProject_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FavoriteProject_projectId_fkey'
  ) THEN
    ALTER TABLE "FavoriteProject"
      ADD CONSTRAINT "FavoriteProject_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChangeLog_projectId_fkey'
  ) THEN
    ALTER TABLE "ChangeLog"
      ADD CONSTRAINT "ChangeLog_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChangeLog_userId_fkey'
  ) THEN
    ALTER TABLE "ChangeLog"
      ADD CONSTRAINT "ChangeLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentSnapshot_projectId_fkey'
  ) THEN
    ALTER TABLE "DocumentSnapshot"
      ADD CONSTRAINT "DocumentSnapshot_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentSnapshot_userId_fkey'
  ) THEN
    ALTER TABLE "DocumentSnapshot"
      ADD CONSTRAINT "DocumentSnapshot_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
