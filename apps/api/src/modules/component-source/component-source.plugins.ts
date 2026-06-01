import type {
  ComponentSourceCredentialResolver,
  ComponentSourcePlugin,
  ComponentSourcePort,
} from "@theforge/component-source";
import { createOrbitaPlugin } from "@theforge/component-source-orbita";
import type { ComponentSourceCredentialService } from "./component-source-credential.service.js";

export interface ComponentSourcePluginsDeps {
  credentialService: ComponentSourceCredentialService;
}

type PluginFactory = (resolver: ComponentSourceCredentialResolver) => ComponentSourcePlugin;

const PLUGIN_FACTORIES: Record<string, PluginFactory> = {
  orbita: (resolver) => createOrbitaPlugin(resolver),
};

/** Canonical plugin id (trimmed, lowercase). Matches PLUGIN_FACTORIES keys and plugin meta.id. */
export function normalizeComponentSourcePluginId(
  pluginId: string | undefined | null,
): string | undefined {
  const trimmed = pluginId?.trim();
  if (!trimmed) return undefined;
  return trimmed.toLowerCase();
}

/** Registers built-in component source plugins. */
export function buildComponentSourcePlugins(
  deps: ComponentSourcePluginsDeps,
): ComponentSourcePlugin[] {
  const resolver = deps.credentialService.createUrlTokenResolver();
  return Object.values(PLUGIN_FACTORIES).map((factory) => factory(resolver));
}

/** Creates a port for connection tests with draft credentials (only entry point for vendor plugins). */
export function createPluginInstance(
  pluginId: string,
  resolver: ComponentSourceCredentialResolver,
): ComponentSourcePort {
  const id = normalizeComponentSourcePluginId(pluginId);
  const factory = id ? PLUGIN_FACTORIES[id] : undefined;
  if (!factory) {
    throw new Error(`Plugin "${pluginId}" no soportado`);
  }
  const plugin = factory(resolver);
  if (plugin.createWithResolver) {
    return plugin.createWithResolver(resolver);
  }
  return plugin.create();
}
