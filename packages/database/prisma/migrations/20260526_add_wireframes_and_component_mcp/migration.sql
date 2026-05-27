-- DropForeignKey
ALTER TABLE "FavoriteProject" DROP CONSTRAINT "FavoriteProject_projectId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteProject" DROP CONSTRAINT "FavoriteProject_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserAISettings" DROP CONSTRAINT "UserAISettings_mddFastTaskTenantInstanceId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "implementationPackGeneratedAt",
DROP COLUMN "implementationPackJson",
DROP COLUMN "implementationPackMddHash",
ADD COLUMN     "uxGuideDesignRef" TEXT,
ADD COLUMN     "wireframesContent" TEXT,
ALTER COLUMN "phase0Status" DROP NOT NULL,
ALTER COLUMN "phase0Questions" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProviderInstance" DROP COLUMN "fastTaskChatModel";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "componentMcpName" TEXT,
ADD COLUMN     "componentMcpTokenCipher" TEXT,
ADD COLUMN     "componentMcpTokenKeyVersion" INTEGER,
ADD COLUMN     "componentMcpUrl" TEXT;

-- AlterTable
ALTER TABLE "UserAISettings" DROP COLUMN "mddFastTaskTenantInstanceId";

-- DropTable
DROP TABLE "checkpoint_blobs";

-- DropTable
DROP TABLE "checkpoint_migrations";

-- DropTable
DROP TABLE "checkpoint_writes";

-- DropTable
DROP TABLE "checkpoints";

-- AddForeignKey
ALTER TABLE "FavoriteProject" ADD CONSTRAINT "FavoriteProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteProject" ADD CONSTRAINT "FavoriteProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

