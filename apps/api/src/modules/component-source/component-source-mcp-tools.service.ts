import { Injectable } from "@nestjs/common";
import {
  ComponentSourceError,
  type ComponentSourceCredentials,
} from "@theforge/component-source";
import {
  computeToolsListHash,
  McpRpcClient,
  type McpToolDefinition,
} from "@theforge/component-source-mcp";

@Injectable()
export class ComponentSourceMcpToolsService {
  async checkHealth(credentials: ComponentSourceCredentials) {
    const client = new McpRpcClient(credentials);
    return client.checkHealth();
  }

  async fetchToolsList(credentials: ComponentSourceCredentials): Promise<{
    tools: McpToolDefinition[];
    toolsListHash: string;
  }> {
    const client = new McpRpcClient(credentials);
    try {
      const tools = await client.listTools();
      return {
        tools,
        toolsListHash: computeToolsListHash(tools),
      };
    } catch (err) {
      if (err instanceof ComponentSourceError) throw err;
      throw new ComponentSourceError(
        err instanceof Error ? err.message : "No se pudo obtener tools/list del MCP",
      );
    }
  }

  computeToolsListHash(tools: McpToolDefinition[]): string {
    return computeToolsListHash(tools);
  }
}
