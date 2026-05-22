-- Modelo de auditor por instancia de proveedor (misma API key que el resto del grafo).
ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "auditorChatModel" TEXT;

ALTER TABLE "UserAISettings" DROP CONSTRAINT IF EXISTS "UserAISettings_mddAuditorTenantInstanceId_fkey";
ALTER TABLE "UserAISettings" DROP COLUMN IF EXISTS "mddAuditorTenantInstanceId";
