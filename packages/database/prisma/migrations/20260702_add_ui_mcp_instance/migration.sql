-- CreateTable
CREATE TABLE "UiMcpInstance" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "tokenKeyVersion" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "teamVisible" BOOLEAN NOT NULL DEFAULT true,
    "compatible" BOOLEAN NOT NULL DEFAULT false,
    "contractVersion" TEXT,
    "libraryName" TEXT,
    "libraryVersion" TEXT,
    "capabilitiesJson" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiMcpInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UiMcpInstance_isActive_idx" ON "UiMcpInstance"("isActive");

-- CreateIndex
CREATE INDEX "UiMcpInstance_enabled_idx" ON "UiMcpInstance"("enabled");

-- AddForeignKey
ALTER TABLE "UiMcpInstance" ADD CONSTRAINT "UiMcpInstance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "uiScreensContent" TEXT;

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN "uiScreensContent" TEXT;
