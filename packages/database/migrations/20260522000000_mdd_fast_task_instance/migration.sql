-- MDD Fast Task: selector de instancia dedicada para cross_consistency inspector (Ajustes → Agentes).
ALTER TABLE "UserAISettings" ADD COLUMN IF NOT EXISTS "mddFastTaskTenantInstanceId" TEXT;

ALTER TABLE "UserAISettings" DROP CONSTRAINT IF EXISTS "UserAISettings_mddFastTaskTenantInstanceId_fkey";
ALTER TABLE "UserAISettings" ADD CONSTRAINT "UserAISettings_mddFastTaskTenantInstanceId_fkey"
  FOREIGN KEY ("mddFastTaskTenantInstanceId") REFERENCES "ProviderInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Modelo por instancia (misma API key) para tareas ligeras del MDD.
ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "fastTaskChatModel" TEXT;
