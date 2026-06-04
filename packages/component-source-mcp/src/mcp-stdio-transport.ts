import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ComponentSourceError,
  type ComponentSourceStdioCredentials,
} from "@theforge/component-source";
import type { ComponentSourceLogger } from "./options.js";

/**
 * MCP JSON-RPC over stdio (spawn subprocess). Used for local servers such as `npx shadcn@latest mcp`.
 */
export class McpStdioTransport {
  private client: Client | null = null;
  private connectPromise: Promise<Client> | null = null;

  constructor(
    private readonly credentials: ComponentSourceStdioCredentials,
    private readonly clientInfo: { name: string; version: string },
    private readonly logger: ComponentSourceLogger,
  ) {}

  async callRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const client = await this.connect();

    if (method === "tools/list") {
      return client.listTools();
    }

    if (method === "tools/call") {
      const name = typeof params.name === "string" ? params.name : "";
      if (!name.trim()) {
        throw new ComponentSourceError("tools/call requiere params.name");
      }
      const toolArgs =
        params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      return client.callTool({ name, arguments: toolArgs });
    }

    throw new ComponentSourceError(`Método MCP stdio no soportado: ${method}`);
  }

  async close(): Promise<void> {
    this.connectPromise = null;
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* ignore shutdown errors */
      }
      this.client = null;
    }
  }

  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.spawnClient().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async spawnClient(): Promise<Client> {
    const { command, args = [], cwd, env } = this.credentials;
    this.logger.log(
      `[ComponentMCP/stdio] spawn command=${command} args=${args.join(" ") || "(none)"}${cwd ? ` cwd=${cwd}` : ""}`,
    );

    const transport = new StdioClientTransport({
      command,
      args,
      ...(cwd?.trim() ? { cwd: cwd.trim() } : {}),
      ...(env && Object.keys(env).length > 0
        ? {
            env: Object.fromEntries(
              Object.entries({ ...process.env, ...env }).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            ),
          }
        : {}),
    });

    const client = new Client(
      { name: this.clientInfo.name, version: this.clientInfo.version },
      { capabilities: {} },
    );

    try {
      await client.connect(transport);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ComponentSourceError(`No se pudo iniciar MCP stdio (${command}): ${message}`);
    }

    this.client = client;
    this.logger.log("[ComponentMCP/stdio] connected");
    return client;
  }
}
