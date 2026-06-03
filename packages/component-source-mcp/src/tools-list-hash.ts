import { createHash } from "node:crypto";
import type { McpToolDefinition } from "./mcp-rpc-client.js";

/** Stable fingerprint of MCP tools/list (names + input schemas). */
export function computeToolsListHash(tools: McpToolDefinition[]): string {
  const normalized = tools
    .map((tool) => ({
      name: tool.name,
      schema: tool.inputSchema ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}
