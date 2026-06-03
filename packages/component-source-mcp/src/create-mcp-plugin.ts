import type {
  ComponentSourceCredentialResolver,
  ComponentSourcePlugin,
  ComponentSourceToolMapping,
} from "@theforge/component-source";
import { DEFAULT_MCP_TOOL_MAPPING } from "./default-tool-mapping.js";
import { MappedMcpComponentSource } from "./mapped-mcp-component-source.js";
import type { McpComponentSourceOptions } from "./options.js";

export function createMcpPlugin(
  resolver: ComponentSourceCredentialResolver,
  options: McpComponentSourceOptions = {},
  defaultToolMapping: ComponentSourceToolMapping = DEFAULT_MCP_TOOL_MAPPING,
): ComponentSourcePlugin {
  const createWithResolver = (
    r: ComponentSourceCredentialResolver,
    toolMapping: ComponentSourceToolMapping = defaultToolMapping,
  ) => new MappedMcpComponentSource(r, toolMapping, options);

  return {
    meta: {
      id: "mcp",
      label: "Component MCP (Streamable HTTP)",
      description: "Design-system catalog via any compatible MCP endpoint (URL + optional Bearer token)",
    },
    create: () => createWithResolver(resolver),
    createWithResolver: (
      r: ComponentSourceCredentialResolver,
      toolMapping?: ComponentSourceToolMapping,
    ) => createWithResolver(r, toolMapping),
  };
}

/** @deprecated Use createMcpPlugin — kept for configs that still reference the Orbita plugin id. */
export function createOrbitaPlugin(
  resolver: ComponentSourceCredentialResolver,
  options: McpComponentSourceOptions = {},
): ComponentSourcePlugin {
  const plugin = createMcpPlugin(resolver, options);
  return {
    ...plugin,
    meta: {
      ...plugin.meta,
      id: "orbita",
      label: "Orbita Component MCP",
      description: "Alias of Component MCP for legacy pluginId \"orbita\"",
    },
  };
}
