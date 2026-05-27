-- Caché JSON de previews MCP por pantalla (wireframes preview)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "wireframesPreviewCache" JSONB;
