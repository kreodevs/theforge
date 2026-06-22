-- P2: delta change spec per stage 2+ (brownfield alignment)
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "changeSpecContent" TEXT;
