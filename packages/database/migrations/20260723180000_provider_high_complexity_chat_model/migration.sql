-- Modelo top opcional para pipeline MDD HIGH (§3 modelo de datos).
ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "highComplexityChatModel" TEXT;
