-- BYOK: STT, dimensiones de embedding, fallbacks tipados y proveedor de embeddings.

ALTER TABLE "UserAISettings" ADD COLUMN IF NOT EXISTS "embeddingProvider" TEXT;

ALTER TABLE "UserProviderConfig" ADD COLUMN IF NOT EXISTS "chatModelFallbacks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserProviderConfig" ADD COLUMN IF NOT EXISTS "embeddingDimension" INTEGER;
ALTER TABLE "UserProviderConfig" ADD COLUMN IF NOT EXISTS "sttModel" TEXT;
