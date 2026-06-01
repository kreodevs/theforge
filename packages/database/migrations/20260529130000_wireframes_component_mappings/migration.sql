-- Persist component mapper output alongside wireframes markdown for preview resolution.
ALTER TABLE "Project" ADD COLUMN "wireframesComponentMappings" JSONB;
