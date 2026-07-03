/**
 * @fileoverview Transporte MCP genérico (JSON-RPC + SSE) para el **UI MCP**.
 *
 * A diferencia de `TheForgeService.postTheForgeMcp` (que resuelve URL/token desde env/usuario y
 * arrastra el bug de computar `resolvedUrl` pero hacer `fetch(this.baseUrl, …)`), estas funciones
 * reciben **URL y token explícitos** de la instancia `UiMcpInstance` activa. No leen env.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { parseMcpResponse } from "../theforge/mcp-http.util.js";

const MCP_PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_TIMEOUT_MS = 20_000;

/** Conexión a un MCP concreto (instancia activa). */
export interface UiMcpConnection {
  url: string;
  /** Token M2M (opcional si el MCP no requiere auth). */
  token?: string | null;
  timeoutMs?: number;
}

function buildHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  };
  const trimmed = token?.trim();
  if (trimmed) {
    // Alineado con Ariadne/TheForge MCP: algunos servidores usan X-M2M-Token, otros Bearer (p. ej. Kreo UI).
    headers["X-M2M-Token"] = trimmed;
    headers.Authorization = `Bearer ${trimmed}`;
  }
  return headers;
}

/**
 * POST JSON-RPC al MCP. Usa `conn.url` directamente (nunca env). Aborta por timeout.
 * @throws si la red falla o el HTTP no es ok.
 */
async function postJsonRpc(conn: UiMcpConnection, body: object): Promise<unknown> {
  const url = conn.url?.trim();
  if (!url) throw new Error("URL del MCP no configurada");
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(conn.token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(conn.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "sin cuerpo");
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const raw = await response.text();
  return parseMcpResponse(raw);
}

/** Lista los nombres de tools expuestos por el MCP (`tools/list`). */
export async function listUiMcpTools(conn: UiMcpConnection): Promise<string[]> {
  const data = (await postJsonRpc(conn, {
    jsonrpc: "2.0",
    id: `ui-mcp-tools-${Date.now()}`,
    method: "tools/list",
    params: {},
  })) as {
    result?: { tools?: Array<{ name?: unknown }> };
    error?: { message?: string };
  } | null;
  if (!data || data.error) {
    throw new Error(data?.error?.message ?? "tools/list devolvió un error");
  }
  const tools = data.result?.tools ?? [];
  return tools
    .map((t) => (typeof t?.name === "string" ? t.name : null))
    .filter((n): n is string => !!n);
}

/**
 * Llama a un tool MCP y devuelve el texto del primer `content` de tipo `text`.
 * Los tools del contrato UI devuelven ese texto como JSON string (parsear con Zod aparte).
 * @returns el texto del resultado, o null si el tool devolvió error / sin contenido.
 */
export async function callUiMcpToolText(
  conn: UiMcpConnection,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<string | null> {
  const data = (await postJsonRpc(conn, {
    jsonrpc: "2.0",
    id: `ui-mcp-${toolName}-${Date.now()}`,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  })) as {
    result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
    error?: { message?: string };
  } | null;
  if (!data || data.error) {
    throw new Error(data?.error?.message ?? `${toolName} devolvió un error JSON-RPC`);
  }
  if (data.result?.isError) {
    const errText = data.result?.content?.find((c) => c.type === "text")?.text;
    throw new Error(errText ?? `${toolName} devolvió isError`);
  }
  const text = data.result?.content?.find((c) => c.type === "text")?.text ?? null;
  return typeof text === "string" ? text : null;
}

/**
 * Llama a un tool MCP y parsea su texto como JSON. Devuelve `null` si no hay texto.
 * @throws si el texto no es JSON válido.
 */
export async function callUiMcpToolJson<T = unknown>(
  conn: UiMcpConnection,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<T | null> {
  const text = await callUiMcpToolText(conn, toolName, args);
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as T;
}
