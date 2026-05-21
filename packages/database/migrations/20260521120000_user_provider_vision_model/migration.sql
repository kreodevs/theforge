-- BYOK: modelo de visión (mensajes con imágenes), paridad con sttModel.

ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "visionModel" TEXT;
ALTER TABLE "UserProviderConfig" ADD COLUMN IF NOT EXISTS "visionModel" TEXT;
