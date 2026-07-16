-- MDD lean: tier B (graph) y tier A (architect) en instancias de proveedor.
ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "graphChatModel" TEXT;
ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "architectChatModel" TEXT;

-- Migrar auditorChatModel legado → graphChatModel cuando el tier B aún está vacío.
UPDATE "ProviderInstance"
SET "graphChatModel" = "auditorChatModel"
WHERE ("graphChatModel" IS NULL OR TRIM("graphChatModel") = '')
  AND "auditorChatModel" IS NOT NULL
  AND TRIM("auditorChatModel") <> '';
