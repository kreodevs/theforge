-- AlterTable (idempotent)
ALTER TABLE "UiMcpInstance" ADD COLUMN IF NOT EXISTS "adapterId" TEXT;
