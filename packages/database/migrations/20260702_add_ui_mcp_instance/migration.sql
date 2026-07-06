-- UiMcpInstance + uiScreensContent (idempotent for db push / path migration replays)

CREATE TABLE IF NOT EXISTS "UiMcpInstance" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "tokenKeyVersion" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "teamVisible" BOOLEAN NOT NULL DEFAULT true,
    "compatible" BOOLEAN NOT NULL DEFAULT false,
    "contractVersion" TEXT,
    "libraryName" TEXT,
    "libraryVersion" TEXT,
    "capabilitiesJson" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiMcpInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UiMcpInstance_isActive_idx" ON "UiMcpInstance"("isActive");
CREATE INDEX IF NOT EXISTS "UiMcpInstance_enabled_idx" ON "UiMcpInstance"("enabled");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UiMcpInstance_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "UiMcpInstance"
      ADD CONSTRAINT "UiMcpInstance_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "uiScreensContent" TEXT;
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "uiScreensContent" TEXT;
