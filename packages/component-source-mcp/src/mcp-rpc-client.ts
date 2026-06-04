import {
  ComponentSourceError,
  isHttpCredentials,
  isStdioCredentials,
  parseMcpResponse,
  type ComponentHealthCheck,
  type ComponentSourceCredentials,
} from "@theforge/component-source";
import {
  defaultComponentSourceLogger,
  type ComponentSourceLogger,
  type McpComponentSourceOptions,
} from "./options.js";
import {
  probeHttpHealthEndpoint,
  shouldFallbackHealthToMcpTools,
} from "./mcp-health-probe.js";
import { McpStdioTransport } from "./mcp-stdio-transport.js";
import {
  buildMcpHttpHeaders,
  initializeMcpHttpSession,
} from "./mcp-transport.util.js";

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
 * MCP client for Streamable HTTP or stdio subprocess transport.
 * Session state is scoped to this client instance (not keyed by userId).
 */
export class McpRpcClient {
  private readonly logger: ComponentSourceLogger;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private session: McpSession | null = null;
  private sessionInitLock: Promise<string> | null = null;
  private stdioTransport: McpStdioTransport | null = null;

  constructor(
    private readonly credentials: ComponentSourceCredentials,
    options: McpComponentSourceOptions = {},
  ) {
    this.logger = options.logger ?? defaultComponentSourceLogger;
    this.clientName = options.clientName ?? "theforge";
    this.clientVersion = options.clientVersion ?? "1.0.0";
  }

  async checkHealth(): Promise<ComponentHealthCheck> {
    if (isStdioCredentials(this.credentials)) {
      try {
        const tools = await this.listTools();
        if (tools.length === 0) {
          return {
            ok: false,
            error: "MCP stdio respondió pero tools/list no devolvió herramientas",
          };
        }
        return { ok: true, service: "mcp-stdio" };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const { url, token } = this.credentials;
    const http = await probeHttpHealthEndpoint(url, token);
    if (http.ok) return http;
    if (!shouldFallbackHealthToMcpTools(http.error)) return http;

    try {
      const tools = await this.listTools();
      if (tools.length === 0) {
        return {
          ok: false,
          error: "MCP respondió pero tools/list no devolvió herramientas",
        };
      }
      return { ok: true, service: "mcp-tools" };
    } catch (err) {
      const mcpErr = err instanceof Error ? err.message : String(err);
      const prefix = http.error ? `${http.error}; ` : "";
      return { ok: false, error: `${prefix}MCP tools/list: ${mcpErr}` };
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
    if (isStdioCredentials(this.credentials)) {
      return this.getStdioTransport().callRpc(method, params);
    }
    return this.callHttpRpcWithRetry(method, params, true);
  }

  async close(): Promise<void> {
    if (this.stdioTransport) {
      await this.stdioTransport.close();
      this.stdioTransport = null;
    }
    this.session = null;
    this.sessionInitLock = null;
  }

  private getStdioTransport(): McpStdioTransport {
    if (!this.stdioTransport) {
      if (!isStdioCredentials(this.credentials)) {
        throw new ComponentSourceError("Transporte stdio no configurado");
      }
      this.stdioTransport = new McpStdioTransport(
        this.credentials,
        { name: this.clientName, version: this.clientVersion },
        this.logger,
      );
    }
    return this.stdioTransport;
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

  private async ensureHttpSession(): Promise<string> {
    const existing = this.getValidSession();
    if (existing) return existing;
    if (this.sessionInitLock) return this.sessionInitLock;

    this.sessionInitLock = this.initializeHttpSession().finally(() => {
      this.sessionInitLock = null;
    });
    return this.sessionInitLock;
  }

  private async initializeHttpSession(): Promise<string> {
    if (!isHttpCredentials(this.credentials)) {
      throw new ComponentSourceError("Transporte HTTP no configurado");
    }
    const { url, token } = this.credentials;
    const sessionId = await initializeMcpHttpSession({
      url,
      token,
      clientName: this.clientName,
      clientVersion: this.clientVersion,
      logger: this.logger,
    });
    this.session = { sessionId, createdAt: Date.now() };
    return sessionId;
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

  private async callHttpRpcWithRetry(
    method: string,
    params: Record<string, unknown>,
    retryOnSessionError: boolean,
  ): Promise<unknown> {
    if (!isHttpCredentials(this.credentials)) {
      throw new ComponentSourceError("Transporte HTTP no configurado");
    }

    const sessionId = await this.ensureHttpSession();
    const rpcId = Date.now();

    const response = await fetch(this.credentials.url, {
      method: "POST",
      headers: buildMcpHttpHeaders(sessionId, this.credentials.token),
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
        return this.callHttpRpcWithRetry(method, params, false);
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
