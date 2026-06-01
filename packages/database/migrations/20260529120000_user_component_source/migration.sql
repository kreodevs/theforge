-- Evolve User component MCP columns → component source (multi-plugin)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "componentSourceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "componentSourcePluginId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "componentSourceUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "componentSourceTokenCipher" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "componentSourceTokenKeyVersion" INTEGER;

-- Migrate existing data from legacy columns (no-op if already migrated)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'componentMcpUrl'
  ) THEN
    UPDATE "User"
    SET
      "componentSourceEnabled" = ("componentMcpUrl" IS NOT NULL AND TRIM("componentMcpUrl") <> ''),
      "componentSourcePluginId" = CASE
        WHEN "componentMcpUrl" IS NOT NULL
          OR "componentMcpName" IS NOT NULL
          OR "componentMcpTokenCipher" IS NOT NULL
        THEN COALESCE(NULLIF(TRIM("componentMcpName"), ''), 'orbita')
        ELSE NULL
      END,
      "componentSourceUrl" = "componentMcpUrl",
      "componentSourceTokenCipher" = "componentMcpTokenCipher",
      "componentSourceTokenKeyVersion" = "componentMcpTokenKeyVersion";

    ALTER TABLE "User" DROP COLUMN IF EXISTS "componentMcpName";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "componentMcpUrl";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "componentMcpTokenCipher";
    ALTER TABLE "User" DROP COLUMN IF EXISTS "componentMcpTokenKeyVersion";
  END IF;
END $$;
