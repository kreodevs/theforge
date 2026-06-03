import {
  ComponentSourceError,
  parseMcpResponse,
  type ComponentHealthCheck,
  type ComponentSourceUrlTokenCredentials,
} from "@theforge/component-source";
import {
  defaultComponentSourceLogger,
  type ComponentSourceLogger,
  type McpComponentSourceOptions,
} from "./options.js";

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface McpSession {
  sessionId: string;
  createdAt: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Lightweight MCP Streamable HTTP client for initialize, tools/list and JSON-RPC calls.
 * Session state is scoped to this client instance (not keyed by userId).
 */
export class McpRpcClient {
  private readonly logger: ComponentSourceLogger;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private session: McpSession | null = null;
  private sessionInitLock: Promise<string> | null = null;

  constructor(
    private readonly credentials: ComponentSourceUrlTokenCredentials,
    options: McpComponentSourceOptions = {},
  ) {
    this.logger = options.logger ?? defaultComponentSourceLogger;
    this.clientName = options.clientName ?? "theforge";
    this.clientVersion = options.clientVersion ?? "1.0.0";
  }

  async checkHealth(): Promise<ComponentHealthCheck> {
    const { url, token } = this.credentials;
    const healthUrl = url.replace(/\/mcp\/?$/, "/health").replace(/\/+$/, "");
    try {
      const res = await fetch(healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
      }
      const raw = await res.text();
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        return { ok: true, service: typeof data.service === "string" ? data.service : undefined };
      } catch {
        const trimmed = raw.trim().toLowerCase();
        if (trimmed === "ok" || trimmed.includes("ok")) {
          return { ok: true, service: "component-mcp" };
        }
        return { ok: false, error: `Respuesta inesperada: ${raw.slice(0, 100)}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Error de conexión" };
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.callRpc("tools/list", {});
    const tools = extractToolsFromListResult(result);
    if (tools.length === 0) {
      throw new ComponentSourceError("El servidor MCP no devolvió herramientas en tools/list");
    }
    return tools;
  }

  async callRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.callRpcWithRetry(method, params, true);
  }

  private getValidSession(): string | null {
    if (!this.session) return null;
    if (Date.now() - this.session.createdAt > SESSION_TTL_MS) {
      this.session = null;
      return null;
    }
    return this.session.sessionId;
  }

  private invalidateSession(): void {
    this.session = null;
    this.sessionInitLock = null;
  }

  private async ensureSession(): Promise<string> {
    const existing = this.getValidSession();
    if (existing) return existing;
    if (this.sessionInitLock) return this.sessionInitLock;

    this.sessionInitLock = this.initializeSession().finally(() => {
      this.sessionInitLock = null;
    });
    return this.sessionInitLock;
  }

  private async initializeSession(): Promise<string> {
    const { url, token } = this.credentials;

    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: this.clientName, version: this.clientVersion },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "sin cuerpo");
      this.logger.error(`MCP initialize HTTP ${response.status}: ${body.slice(0, 300)}`);
      throw new ComponentSourceError(`Component MCP initialize respondió HTTP ${response.status}`);
    }

    const sessionId = response.headers.get("mcp-session-id");
    if (!sessionId) {
      throw new ComponentSourceError(
        "Component MCP no devolvió mcp-session-id en la respuesta de initialize",
      );
    }

    this.session = { sessionId, createdAt: Date.now() };
    await this.sendInitializedNotification(sessionId);
    return sessionId;
  }

  private async sendInitializedNotification(sessionId: string): Promise<void> {
    const { token } = this.credentials;
    const response = await fetch(this.credentials.url, {
      method: "POST",
      headers: this.buildHeaders(sessionId),
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 202) {
      const body = await response.text().catch(() => "");
      this.logger.warn(
        `MCP notifications/initialized HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
    }
  }

  private buildHeaders(sessionId?: string): Record<string, string> {
    const { token } = this.credentials;
    return {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private isStaleSessionResponse(status: number, bodyText: string): boolean {
    const lower = bodyText.toLowerCase();
    const sessionHint =
      lower.includes("session not found") ||
      lower.includes("session expired") ||
      lower.includes("invalid session") ||
      lower.includes("unknown session") ||
      lower.includes('"code":-32001') ||
      (lower.includes("session") && lower.includes("not found"));
    if (sessionHint) return true;
    if (status === 404 && lower.includes("jsonrpc")) return true;
    if (status === 400 && (lower.includes("session") || lower.includes("initialize"))) {
      return true;
    }
    return false;
  }

  private async callRpcWithRetry(
    method: string,
    params: Record<string, unknown>,
    retryOnSessionError: boolean,
  ): Promise<unknown> {
    const sessionId = await this.ensureSession();
    const rpcId = Date.now();

    const response = await fetch(this.credentials.url, {
      method: "POST",
      headers: this.buildHeaders(sessionId),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: rpcId,
        method,
        params,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "sin cuerpo");
      if (retryOnSessionError && this.isStaleSessionResponse(response.status, text)) {
        this.logger.warn(`MCP session invalid for ${method} (HTTP ${response.status}), re-initializing…`);
        this.invalidateSession();
        return this.callRpcWithRetry(method, params, false);
      }
      throw new ComponentSourceError(`Component MCP ${method} HTTP ${response.status}`);
    }

    const raw = await response.text();
    const parsed = parseMcpResponse(raw) as Record<string, unknown> | null;
    if (!parsed) {
      throw new ComponentSourceError(`Respuesta MCP inválida para ${method}`);
    }
    if (parsed.error) {
      const errMsg =
        typeof parsed.error === "object" ? JSON.stringify(parsed.error) : String(parsed.error);
      throw new ComponentSourceError(`Component MCP error (${method}): ${errMsg}`);
    }

    return parsed.result ?? parsed;
  }
}

function extractToolsFromListResult(result: unknown): McpToolDefinition[] {
  if (!result || typeof result !== "object") return [];
  const record = result as Record<string, unknown>;
  const tools = record.tools;
  if (!Array.isArray(tools)) return [];

  return tools
    .map((entry): McpToolDefinition | null => {
      if (!entry || typeof entry !== "object") return null;
      const tool = entry as Record<string, unknown>;
      const name = typeof tool.name === "string" ? tool.name.trim() : "";
      if (!name) return null;
      return {
        name,
        ...(typeof tool.description === "string" ? { description: tool.description } : {}),
        ...(tool.inputSchema !== undefined || tool.input_schema !== undefined
          ? { inputSchema: tool.inputSchema ?? tool.input_schema }
          : {}),
      };
    })
    .filter((t): t is McpToolDefinition => t !== null);
}
