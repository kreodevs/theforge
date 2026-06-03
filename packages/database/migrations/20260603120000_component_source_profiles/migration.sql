-- Component Source Profiles: per-user MCP profiles + optional project assignment (no default).

CREATE TABLE IF NOT EXISTS "ComponentSourceProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pluginId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "tokenCipher" TEXT,
  "tokenKeyVersion" INTEGER,
  "toolMapping" JSONB,
  "capabilities" JSONB,
  "toolsListHash" TEXT,
  "mappedAt" TIMESTAMP(3),
  "mappingConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComponentSourceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComponentSourceProfile_userId_name_key"
  ON "ComponentSourceProfile"("userId", "name");
CREATE INDEX IF NOT EXISTS "ComponentSourceProfile_userId_idx"
  ON "ComponentSourceProfile"("userId");

ALTER TABLE "ComponentSourceProfile"
  ADD CONSTRAINT "ComponentSourceProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "componentSourceProfileId" TEXT;
CREATE INDEX IF NOT EXISTS "Project_componentSourceProfileId_idx"
  ON "Project"("componentSourceProfileId");

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_componentSourceProfileId_fkey"
  FOREIGN KEY ("componentSourceProfileId") REFERENCES "ComponentSourceProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate legacy User component source rows into named profiles (projects stay unassigned).
INSERT INTO "ComponentSourceProfile" (
  "id",
  "userId",
  "name",
  "pluginId",
  "url",
  "tokenCipher",
  "tokenKeyVersion",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  u."id",
  'Perfil migrado',
  COALESCE(NULLIF(TRIM(u."componentSourcePluginId"), ''), 'mcp'),
  u."componentSourceUrl",
  u."componentSourceTokenCipher",
  u."componentSourceTokenKeyVersion",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
WHERE u."componentSourceUrl" IS NOT NULL
  AND TRIM(u."componentSourceUrl") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "ComponentSourceProfile" p WHERE p."userId" = u."id"
  );
