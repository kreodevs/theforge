export { MappedMcpComponentSource } from "./mapped-mcp-component-source.js";
export { DEFAULT_MCP_TOOL_MAPPING } from "./default-tool-mapping.js";
export { McpComponentSource } from "./mcp-component-source.js";
export { McpRpcClient, type McpToolDefinition } from "./mcp-rpc-client.js";
export { computeToolsListHash } from "./tools-list-hash.js";
export { createMcpPlugin, createOrbitaPlugin } from "./create-mcp-plugin.js";
export type { ComponentSourceLogger, McpComponentSourceOptions } from "./options.js";
export { defaultComponentSourceLogger } from "./options.js";

/** @deprecated Use McpComponentSource */
export { McpComponentSource as OrbitaComponentSource } from "./mcp-component-source.js";

/** @deprecated Use McpComponentSourceOptions */
export type { McpComponentSourceOptions as OrbitaComponentSourceOptions } from "./options.js";
