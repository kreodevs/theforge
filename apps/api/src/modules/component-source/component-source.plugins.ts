import type {
  ComponentSourceCredentialResolver,
  ComponentSourcePlugin,
  ComponentSourcePort,
  ComponentSourceToolMapping,
} from "@theforge/component-source";
import {
  createMcpPlugin,
  DEFAULT_MCP_TOOL_MAPPING,
  MappedMcpComponentSource,
} from "@theforge/component-source-mcp";

/** @deprecated Kept for call-site compatibility; plugins no longer bind user-level resolvers at registration. */
export interface ComponentSourcePluginsDeps {
  credentialService?: unknown;
}

type PluginFactory = (resolver: ComponentSourceCredentialResolver) => ComponentSourcePlugin;

/** Legacy plugin ids stored in BD map to the current factory key. */
const LEGACY_PLUGIN_IDS: Record<string, string> = {
  orbita: "mcp",
};

const PLUGIN_FACTORIES: Record<string, PluginFactory> = {
  mcp: (resolver) => createMcpPlugin(resolver),
};

/** Canonical plugin id (trimmed, lowercase). Matches PLUGIN_FACTORIES keys and plugin meta.id. */
export function normalizeComponentSourcePluginId(
  pluginId: string | undefined | null,
): string | undefined {
  const trimmed = pluginId?.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  return LEGACY_PLUGIN_IDS[lower] ?? lower;
}

/** Stub resolver at registration time; runtime uses createPluginInstance + profile resolver. */
const REGISTER_STUB_RESOLVER: ComponentSourceCredentialResolver = async () => {
  throw new Error("Component source credentials resolve per profile at runtime");
};

/** Registers built-in component source plugins (metadata + factories only). */
export function buildComponentSourcePlugins(
  _deps: ComponentSourcePluginsDeps = {},
): ComponentSourcePlugin[] {
  return Object.values(PLUGIN_FACTORIES).map((factory) => factory(REGISTER_STUB_RESOLVER));
}

/** Creates a port for connection tests with draft credentials (only entry point for vendor plugins). */
export function createPluginInstance(
  pluginId: string,
  resolver: ComponentSourceCredentialResolver,
  toolMapping?: ComponentSourceToolMapping,
): ComponentSourcePort {
  const id = normalizeComponentSourcePluginId(pluginId);
  const factory = id ? PLUGIN_FACTORIES[id] : undefined;
  if (!factory) {
    throw new Error(`Plugin "${pluginId}" no soportado`);
  }

  if (id === "mcp") {
    return new MappedMcpComponentSource(resolver, toolMapping ?? DEFAULT_MCP_TOOL_MAPPING);
  }

  const plugin = factory(resolver);
  if (plugin.createWithResolver) {
    return plugin.createWithResolver(resolver);
  }
  return plugin.create();
}
