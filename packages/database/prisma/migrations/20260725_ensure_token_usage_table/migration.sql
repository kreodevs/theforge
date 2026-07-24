-- ============================================================================
-- Defensa tras migración faltante: 20260724_add_token_usage no se aplicó en
-- algunas deploys (sospecha: timestamp + cache de imagen). Esta migración es
-- idempotente (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS) y
-- re-asegura el esquema de TokenUsage aunque la migración previa ya hubiera
-- corrido.
--
-- Después de este commit, el despliegue con la imagen nueva debe:
--   1. Aplicar 20260724_add_token_usage (si no se aplicó antes) — via migrate deploy.
--   2. Aplicar 20260725_ensure_token_usage_table (no-op si la tabla ya existe).
--   3. Si el deploy saltea Prisma migrate deploy (caso edge), el PrismaService
--      tiene un fallback en onModuleInit que ejecuta este CREATE TABLE IF NOT EXISTS
--      por SQL directo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "TokenUsage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "documentField" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "node" TEXT,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "costMxn" DOUBLE PRECISION NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'TokenUsage_projectId_fkey') THEN
    ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'TokenUsage_stageId_fkey') THEN
    ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TokenUsage_projectId_documentField_createdAt_idx" ON "TokenUsage"("projectId", "documentField", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "TokenUsage_stageId_documentField_idx" ON "TokenUsage"("stageId", "documentField");

CREATE INDEX IF NOT EXISTS "TokenUsage_projectId_providerId_modelId_idx" ON "TokenUsage"("projectId", "providerId", "modelId");

CREATE INDEX IF NOT EXISTS "TokenUsage_projectId_createdAt_idx" ON "TokenUsage"("projectId", "createdAt" DESC);
