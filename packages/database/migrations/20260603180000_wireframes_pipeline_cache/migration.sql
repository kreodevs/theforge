-- Cache de pantallas del pipeline wireframes (reutilizar en refresh DS)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "wireframesPipelineCache" JSONB;
