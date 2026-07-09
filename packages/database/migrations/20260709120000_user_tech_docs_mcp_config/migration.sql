-- Per-user Technology Docs MCP (Context7-compatible) settings
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "techDocsMcpUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "techDocsMcpToken" TEXT;
