-- Domain inventory SSOT on Stage (capabilities, entities, processes, CrudMatrix).
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "domainInventory" JSONB;
