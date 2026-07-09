/**
 * @fileoverview Transporte MCP genérico (JSON-RPC + SSE) para el **UI MCP**.
 *
 * A diferencia de `TheForgeService.postTheForgeMcp` (que resuelve URL/token desde env/usuario y
 * arrastra el bug de computar `resolvedUrl` pero hacer `fetch(this.baseUrl, …)`), estas funciones
 * reciben **URL y token explícitos** de la instancia `UiMcpInstance` activa. No leen env.
 *
 * Para ds-mcp (Streamable HTTP stateful), hace `initialize` + `notifications/initialized` una vez
 * por URL/token y reutiliza `Mcp-Session-Id`. ds-mcp también acepta `tools/list` sin sesión previa
 * (auto-sesión efímera) como respaldo.
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
  /** Headers adicionales (p. ej. `CONTEXT7_API_KEY` en Context7 remoto). */
  extraHeaders?: Record<string, string>;
}

/** Sesiones MCP Streamable HTTP por URL+token (ds-mcp / componentes.obp.mx). */
const sessionByConnectionKey = new Map<string, string>();

function connectionCacheKey(conn: UiMcpConnection): string {
  return `${conn.url?.trim() ?? ""}|${conn.token?.trim() ?? ""}`;
}

/** Hosts ds-mcp desplegado (Forge Ajustes → componentes.obp.mx). */
export function isDsMcpRemoteUrl(url: string): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === "componentes.obp.mx" || host.endsWith(".componentes.obp.mx");
  } catch {
    return false;
  }
}

/** Streamable HTTP con sesión MCP (ds-mcp local o remoto). */
export function requiresMcpSession(url: string): boolean {
  if (isDsMcpRemoteUrl(url)) return true;
  try {
    const parsed = new URL(url.trim());
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    return (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      port === "3100" &&
      parsed.pathname.replace(/\/+$/, "").endsWith("/mcp")
    );
  } catch {
    return false;
  }
}

function buildHeaders(
  token?: string | null,
  sessionId?: string | null,
  url?: string,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    ...(extraHeaders ?? {}),
  };
  const trimmed = token?.trim();
  if (trimmed) {
    // Alineado con Ariadne/TheForge MCP: algunos servidores usan X-M2M-Token, otros Bearer (p. ej. Kreo UI).
    headers["X-M2M-Token"] = trimmed;
    headers.Authorization = `Bearer ${trimmed}`;
    if (url && isDsMcpRemoteUrl(url)) {
      headers["X-IMJ-DS-MCP-Token"] = trimmed;
    }
  }
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }
  return headers;
}

type FetchResult = { ok: boolean; status: number; text: string; sessionId: string | null };

async function fetchJsonRpc(
  conn: UiMcpConnection,
  body: object,
  sessionId?: string | null,
): Promise<FetchResult> {
  const url = conn.url?.trim();
  if (!url) throw new Error("URL del MCP no configurada");
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(conn.token, sessionId, url, conn.extraHeaders),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(conn.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  const text = await response.text().catch(() => "");
  const newSession =
    response.headers.get("mcp-session-id") ?? response.headers.get("Mcp-Session-Id");
  return {
    ok: response.ok,
    status: response.status,
    text,
    sessionId: newSession,
  };
}

/** Invalida sesión cacheada (p. ej. tras 404 Session not found). */
export function clearUiMcpSession(conn: UiMcpConnection): void {
  sessionByConnectionKey.delete(connectionCacheKey(conn));
}

async function ensureMcpSession(conn: UiMcpConnection): Promise<string | undefined> {
  if (!requiresMcpSession(conn.url)) return undefined;
  const key = connectionCacheKey(conn);
  const cached = sessionByConnectionKey.get(key);
  if (cached) return cached;

  const init = await fetchJsonRpc(conn, {
    jsonrpc: "2.0",
    id: `ui-mcp-init-${Date.now()}`,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "theforge-ui-mcp", version: "1.0.0" },
    },
  });
  if (!init.ok) {
    throw new Error(`initialize MCP falló (HTTP ${init.status}): ${init.text.slice(0, 200)}`);
  }
  const sessionId = init.sessionId ?? undefined;
  if (!sessionId) return undefined;

  sessionByConnectionKey.set(key, sessionId);

  await fetchJsonRpc(
    conn,
    { jsonrpc: "2.0", method: "notifications/initialized" },
    sessionId,
  ).catch(() => {
    /* algunos servidores no exigen la notificación */
  });

  return sessionId;
}

/**
 * POST JSON-RPC al MCP. Usa `conn.url` directamente (nunca env). Aborta por timeout.
 * @throws si la red falla o el HTTP no es ok.
 */
async function postJsonRpc(conn: UiMcpConnection, body: object): Promise<unknown> {
  let sessionId = await ensureMcpSession(conn);
  let result = await fetchJsonRpc(conn, body, sessionId);

  if (
    !result.ok &&
    result.status === 404 &&
    sessionId &&
    /session not found/i.test(result.text)
  ) {
    clearUiMcpSession(conn);
    sessionId = await ensureMcpSession(conn);
    result = await fetchJsonRpc(conn, body, sessionId);
  }

  if (!result.ok) {
    throw new Error(`HTTP ${result.status}: ${result.text.slice(0, 200)}`);
  }
  if (result.sessionId && result.sessionId !== sessionId) {
    sessionByConnectionKey.set(connectionCacheKey(conn), result.sessionId);
  }
  return parseMcpResponse(result.text);
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
