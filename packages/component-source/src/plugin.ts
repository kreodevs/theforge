import type { ComponentSourceCredentialResolver } from "./credentials.js";
import type { ComponentSourcePort } from "./port.js";

export interface ComponentSourcePluginMeta {
  id: string;
  label: string;
  description?: string;
}

export interface ComponentSourcePlugin {
  meta: ComponentSourcePluginMeta;
  create: () => ComponentSourcePort;
  /** When set, allows constructing a port with draft/test credentials without re-registering the plugin. */
  createWithResolver?(
    resolver: ComponentSourceCredentialResolver,
    toolMapping?: import("./types.js").ComponentSourceToolMapping,
  ): ComponentSourcePort;
}
