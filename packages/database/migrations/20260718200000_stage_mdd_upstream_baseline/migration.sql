-- Baseline de documentos upstream (DBGA, BRD, Benchmark) al cerrar un MDD — para sync incremental.
ALTER TABLE "Stage" ADD COLUMN IF NOT EXISTS "mddUpstreamBaseline" JSONB;
