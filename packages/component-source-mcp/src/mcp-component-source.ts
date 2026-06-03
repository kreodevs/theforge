import type { ComponentSourceCredentialResolver } from "@theforge/component-source";
import { DEFAULT_MCP_TOOL_MAPPING } from "./default-tool-mapping.js";
import { MappedMcpComponentSource } from "./mapped-mcp-component-source.js";
import type { McpComponentSourceOptions } from "./options.js";

/**
 * @deprecated Use {@link MappedMcpComponentSource} with {@link DEFAULT_MCP_TOOL_MAPPING}
 * or a custom {@link ComponentSourceToolMapping}.
 */
export class McpComponentSource extends MappedMcpComponentSource {
  constructor(
    resolveCredentials: ComponentSourceCredentialResolver,
    options: McpComponentSourceOptions = {},
  ) {
    super(resolveCredentials, DEFAULT_MCP_TOOL_MAPPING, options);
  }
}
