-- Migration: add_stage_derived_spec
-- Created: 2026-07-14
-- Branch: lean-sdd
-- Strategy: Additive ONLY - this migration only creates new tables/columns, never modifies existing.
-- Rollback: DROP TABLE "StageDerivedSpec"; DROP INDEX "StageDerivedSpec_stageId_key";

-- Create Table
CREATE TABLE "StageDerivedSpec" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "typesJson" JSONB NOT NULL,
    "operationsJson" JSONB NOT NULL,
    "tasksJson" JSONB NOT NULL,
    "inferenceRules" JSONB,
    "derivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mddHash" TEXT NOT NULL,

    CONSTRAINT "StageDerivedSpec_pkey" PRIMARY KEY ("id")
);

-- Create Unique Index
CREATE UNIQUE INDEX "StageDerivedSpec_stageId_key" ON "StageDerivedSpec"("stageId");

-- Create Index for queries by derivedAt
CREATE INDEX "StageDerivedSpec_derivedAt_idx" ON "StageDerivedSpec"("derivedAt");

-- Create Foreign Key (additive - no impact on existing data)
ALTER TABLE "StageDerivedSpec" ADD CONSTRAINT "StageDerivedSpec_stageId_fkey" 
    FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
