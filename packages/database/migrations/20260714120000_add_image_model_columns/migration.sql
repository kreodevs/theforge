-- AlterTable
ALTER TABLE "ProviderInstance" ADD COLUMN "imageModel" TEXT;

-- AlterTable
ALTER TABLE "UserAISettings" ADD COLUMN "imageModel" TEXT,
ADD COLUMN "imageQuality" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN "imageStyle" TEXT NOT NULL DEFAULT 'abstract';

-- AlterTable
ALTER TABLE "UserProviderConfig" ADD COLUMN "imageModel" TEXT;
