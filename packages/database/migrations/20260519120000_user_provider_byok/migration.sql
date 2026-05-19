-- BYOK multi-proveedor: preferencias de IA y configuración cifrada por proveedor.

CREATE TABLE IF NOT EXISTS "UserAISettings" (
    "userId" TEXT NOT NULL,
    "activeProvider" TEXT NOT NULL,
    "embeddingsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAISettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "UserProviderConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "tokenKeyVersion" INTEGER NOT NULL,
    "chatModel" TEXT NOT NULL,
    "embeddingModel" TEXT,
    "baseUrl" TEXT,
    "extras" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserProviderConfig_userId_provider_key" ON "UserProviderConfig"("userId", "provider");

CREATE INDEX IF NOT EXISTS "UserProviderConfig_userId_idx" ON "UserProviderConfig"("userId");

ALTER TABLE "UserAISettings" DROP CONSTRAINT IF EXISTS "UserAISettings_userId_fkey";
ALTER TABLE "UserAISettings" ADD CONSTRAINT "UserAISettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProviderConfig" DROP CONSTRAINT IF EXISTS "UserProviderConfig_userId_fkey";
ALTER TABLE "UserProviderConfig" ADD CONSTRAINT "UserProviderConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
