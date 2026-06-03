import { ComponentSourceError } from "@theforge/component-source";
import type { ComponentSourceLogger } from "./options.js";

/** Marcador interno: MCP Streamable HTTP sin cabecera mcp-session-id (p. ej. ui.nuxt.com/mcp). */
export const STATELESS_MCP_SESSION = "__stateless__";

export function isStatelessMcpSession(sessionId: string): boolean {
  return sessionId === STATELESS_MCP_SESSION;
}

export function buildMcpHttpHeaders(
  sessionId: string | undefined,
  token?: string,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(sessionId && !isStatelessMcpSession(sessionId)
      ? { "mcp-session-id": sessionId }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function initializeSucceededInBody(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.error) return false;
    const result = parsed.result;
    if (!result || typeof result !== "object") return false;
    const r = result as Record<string, unknown>;
    return typeof r.protocolVersion === "string" || r.serverInfo != null;
  } catch {
    return false;
  }
}

export async function initializeMcpHttpSession(args: {
  url: string;
  token?: string;
  clientName: string;
  clientVersion: string;
  logger?: ComponentSourceLogger;
}): Promise<string> {
  const { url, token, clientName, clientVersion, logger } = args;

  const response = await fetch(url, {
    method: "POST",
    headers: buildMcpHttpHeaders(undefined, token),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: clientName, version: clientVersion },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await response.text().catch(() => "");

  if (!response.ok) {
    logger?.error(`MCP initialize HTTP ${response.status}: ${raw.slice(0, 300)}`);
    throw new ComponentSourceError(`Component MCP initialize respondió HTTP ${response.status}`);
  }

  const sessionId = response.headers.get("mcp-session-id")?.trim();
  if (sessionId) {
    await sendMcpInitializedNotification({ url, token, sessionId, logger });
    logger?.log(`MCP session initialized (streamable HTTP)`);
    return sessionId;
  }

  if (initializeSucceededInBody(raw)) {
    await sendMcpInitializedNotification({ url, token, sessionId: undefined, logger });
    logger?.log("MCP session initialized (stateless HTTP — sin mcp-session-id)");
    return STATELESS_MCP_SESSION;
  }

  throw new ComponentSourceError(
    "Component MCP no devolvió mcp-session-id ni un resultado initialize válido en el cuerpo",
  );
}

export async function sendMcpInitializedNotification(args: {
  url: string;
  token?: string;
  sessionId?: string;
  logger?: ComponentSourceLogger;
}): Promise<void> {
  const { url, token, sessionId, logger } = args;
  const response = await fetch(url, {
    method: "POST",
    headers: buildMcpHttpHeaders(sessionId, token),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 202) {
    const body = await response.text().catch(() => "");
    logger?.warn(
      `MCP notifications/initialized HTTP ${response.status}: ${body.slice(0, 200)}`,
    );
  }
}
