-- Migration: Add RFC-001 Document Engine v2 AST fields to Stage
-- Generated: 2026-07-15

DO $$ 
BEGIN
    -- Add documentAst JSON column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Stage' AND column_name = 'documentAst'
    ) THEN
        ALTER TABLE "Stage" ADD COLUMN "documentAst" JSONB;
    END IF;

    -- Add documentVersion integer column with default 0
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Stage' AND column_name = 'documentVersion'
    ) THEN
        ALTER TABLE "Stage" ADD COLUMN "documentVersion" INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;
