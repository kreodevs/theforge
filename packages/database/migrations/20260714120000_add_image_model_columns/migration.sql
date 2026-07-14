-- AlterTable
ALTER TABLE "ProviderInstance" ADD COLUMN IF NOT EXISTS "imageModel" TEXT;

-- AlterTable
ALTER TABLE "UserAISettings" ADD COLUMN IF NOT EXISTS "imageModel" TEXT,
ADD COLUMN IF NOT EXISTS "imageQuality" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS "imageStyle" TEXT NOT NULL DEFAULT 'abstract';

-- AlterTable
ALTER TABLE "UserProviderConfig" ADD COLUMN IF NOT EXISTS "imageModel" TEXT;
