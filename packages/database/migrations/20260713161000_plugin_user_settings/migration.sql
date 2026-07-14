-- Ajustes de usuario por plugin (paneles enganchados en Ajustes → Plugins)
ALTER TABLE "UserAISettings" ADD COLUMN IF NOT EXISTS "pluginUserSettings" JSONB;
