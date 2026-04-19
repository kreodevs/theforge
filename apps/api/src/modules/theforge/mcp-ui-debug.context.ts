import { AsyncLocalStorage } from "node:async_hooks";

/** Una ida y vuelta JSON-RPC al MCP Ariadne (Streamable HTTP). */
export type McpUiDebugEntry = {
  at: string;
  /** JSON-RPC `method` (p. ej. `tools/call`). */
  rpcMethod: string;
  /** Si `tools/call`, nombre de la herramienta MCP. */
  toolName?: string;
  requestJson: string;
  responseHttpStatus: number;
  responseBodyPreview: string;
  durationMs: number;
};

const als = new AsyncLocalStorage<{ entries: McpUiDebugEntry[] }>();

export function isMcpUiDebugActive(): boolean {
  return als.getStore() != null;
}

export function appendMcpUiDebug(entry: McpUiDebugEntry): void {
  const s = als.getStore();
  if (s) s.entries.push(entry);
}

/** Ejecuta `fn` con captura de trazas MCP en `postTheForgeMcp`. */
export async function runWithMcpUiDebug<T>(fn: () => Promise<T>): Promise<{ result: T; trace: McpUiDebugEntry[] }> {
  const entries: McpUiDebugEntry[] = [];
  const result = await als.run({ entries }, fn);
  return { result, trace: entries };
}

export function isLegacyCodebaseDocMcpDebugUiEnabled(): boolean {
  const v = process.env.LEGACY_CODEBASE_DOC_MCP_DEBUG_UI?.trim().toLowerCase();
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
