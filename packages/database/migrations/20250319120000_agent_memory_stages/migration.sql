-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "EpisodicMemoryKind" AS ENUM ('REASONING_TRACE', 'ARCHITECTURE_DECISION', 'REFLEXION_FEEDBACK', 'EVALUATOR_REJECTION', 'TOOL_OUTPUT');

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 1,
    "key" TEXT,
    "name" TEXT,
    "status" "StageStatus" NOT NULL DEFAULT 'DRAFT',
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "relicProjectId" TEXT,
    "shortTermContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodicMemory" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "kind" "EpisodicMemoryKind" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodicMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stage_projectId_ordinal_key" ON "Stage"("projectId", "ordinal");

-- CreateIndex
CREATE INDEX "Stage_projectId_idx" ON "Stage"("projectId");

-- CreateIndex
CREATE INDEX "EpisodicMemory_stageId_createdAt_idx" ON "EpisodicMemory"("stageId", "createdAt");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodicMemory" ADD CONSTRAINT "EpisodicMemory_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
