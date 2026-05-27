-- Caché JSON de bocetos HTML por pantalla (wireframes preview)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "wireframesSketchesCache" JSONB;
