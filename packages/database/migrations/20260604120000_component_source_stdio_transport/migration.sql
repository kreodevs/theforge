-- Perfiles MCP: transporte HTTP (URL) o stdio (command + args) para servidores locales (p. ej. shadcn mcp).

ALTER TABLE "ComponentSourceProfile" ADD COLUMN IF NOT EXISTS "transportType" TEXT NOT NULL DEFAULT 'http';
ALTER TABLE "ComponentSourceProfile" ADD COLUMN IF NOT EXISTS "command" TEXT;
ALTER TABLE "ComponentSourceProfile" ADD COLUMN IF NOT EXISTS "args" JSONB;
ALTER TABLE "ComponentSourceProfile" ADD COLUMN IF NOT EXISTS "cwd" TEXT;
