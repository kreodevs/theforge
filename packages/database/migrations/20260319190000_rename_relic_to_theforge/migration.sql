-- Rename relicProjectId to theforgeProjectId in Project and Stage
ALTER TABLE "Project" RENAME COLUMN "relicProjectId" TO "theforgeProjectId";
ALTER TABLE "Stage" RENAME COLUMN "relicProjectId" TO "theforgeProjectId";
