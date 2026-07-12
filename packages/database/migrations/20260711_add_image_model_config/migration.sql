-- AlterTable: Add image model configuration fields
ALTER TABLE "ProviderInstance" ADD COLUMN "imageModel" TEXT;
ALTER TABLE "UserProviderConfig" ADD COLUMN "imageModel" TEXT;
ALTER TABLE "UserAISettings" ADD COLUMN "imageModel" TEXT;
ALTER TABLE "UserAISettings" ADD COLUMN "imageQuality" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "UserAISettings" ADD COLUMN "imageStyle" TEXT NOT NULL DEFAULT 'abstract';
