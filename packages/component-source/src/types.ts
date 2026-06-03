/** Shapes returned by the external component design-system MCP tools. */

export interface ComponentModule {
  id: string;
  name: string;
  description?: string;
  exports?: string[];
}

export interface ComponentCode {
  code: string;
  language?: string;
  dependencies?: string[];
}

export interface ComponentProps {
  props: ComponentProp[];
}

export interface ComponentProp {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
}

export interface CompositionRecipe {
  recipe: string;
  description?: string;
}

export interface CatalogPreviewCapabilities {
  supported?: boolean;
  version?: number;
  modes?: Array<"url" | "html">;
  defaultMode?: "url" | "html";
  runtime?: string;
  maxWidth?: number;
  requiresAuth?: boolean;
}

export interface CatalogHealthResult {
  status: string;
  totalModules?: number;
  errors?: string[];
  preview?: CatalogPreviewCapabilities;
  tools?: Record<string, boolean>;
}

export interface ComponentPreviewItem {
  moduleId: string;
  exportName?: string;
  variant?: string;
}

export interface HostedPreviewPayload {
  kind: "html" | "url" | "unavailable";
  mimeType?: string;
  document?: string;
  url?: string;
  recommendedHeight?: number;
  sandbox?: string;
  reason?: string;
  message?: string;
  fallback?: { kind: string; url?: string; screenshotUrl?: string };
}

export interface ComponentPreviewResult {
  moduleId: string;
  exportName?: string;
  preview?: HostedPreviewPayload;
  demoProps?: Record<string, unknown>;
  error?: string;
  message?: string;
}

export interface ComponentPreviewsBatchResult {
  results: ComponentPreviewResult[];
}

export interface StyleRule {
  name: string;
  rule: string;
  category?: string;
}

/** Single resolution result from resolve_component / resolve_components. */
export interface ComponentResolution {
  query: string;
  status: "exact_module" | "exact_export" | "alias" | "similar" | "not_found";
  moduleId?: string;
  exportName?: string;
  legacy?: boolean;
  hint?: string;
  suggestions?: string[];
}

/** Unified wrapper around the JSON-RPC 2.0 result envelope. */
export interface McpToolResult<T = unknown> {
  content: Array<{ type: string; text: string }>;
  _parsed?: T;
}

export interface ComponentHealthCheck {
  ok: boolean;
  service?: string;
  error?: string;
}

export interface ComponentPreviewArgs {
  moduleId: string;
  exportName?: string;
  variant?: string;
  theme?: "light" | "dark";
  mode?: "html" | "url";
}

export interface ComponentPreviewsBatchArgs {
  items: ComponentPreviewItem[];
  theme?: "light" | "dark";
  mode?: "html" | "url";
}

export interface TypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: string;
}

export interface ComponentToken {
  backgroundColor?: string;
  textColor?: string;
  rounded?: string;
  padding?: string | number;
  size?: string | number;
  height?: string | number;
  width?: string | number;
  typography?: string;
}

/** Token palette aligned with The Forge DesignTokens (YAML frontmatter). */
export interface DesignSystemTokens {
  name?: string;
  version?: string;
  description?: string;
  colors?: Record<string, string>;
  typography?: Record<string, TypographyToken>;
  rounded?: Record<string, string>;
  spacing?: Record<string, string>;
  elevation?: Record<string, string>;
  components?: Record<string, ComponentToken>;
}

export interface DesignSystemMeta {
  name: string;
  version: string;
  schemaVersion: string;
  indexedAt: string;
  package: string;
  tokensPackage: string;
  tailwindPrefix: string;
  theme: "light" | "dark";
}

export interface TailwindClassEntry {
  class: string;
  cssVar?: string;
  category: "color" | "spacing" | "typography" | "radius" | "elevation" | "shadow" | "other";
}

export interface ConsumerChecklistItem {
  id: string;
  title: string;
  body: string;
}

export interface DesignSystemCatalogSummary {
  moduleCount: number;
  packages?: string[];
  sampleModuleIds?: string[];
}

export interface DesignSystemResult {
  meta: DesignSystemMeta;
  tokens: DesignSystemTokens;
  cssVars: Record<string, string>;
  tailwindClasses?: TailwindClassEntry[];
  styleRules: StyleRule[];
  consumerChecklist?: ConsumerChecklistItem[];
  catalog: DesignSystemCatalogSummary;
  designMd?: string;
}

export interface GetDesignSystemArgs {
  format?: "full" | "tokens" | "context";
  theme?: "light" | "dark";
  includeMarkdown?: boolean;
}

/**
 * Internal role identifiers — decouple {@link ComponentSourcePort} methods from MCP tool names.
 * `catalog.list` is required; other roles are optional per {@link ComponentSourceCapabilities}.
 */
export type ComponentSourceRole =
  | "catalog.list"
  | "catalog.search"
  | "catalog.resolve"
  | "catalog.get"
  | "catalog.props"
  | "catalog.recipe"
  | "catalog.health"
  | "designSystem.get"
  | "designSystem.styleRules"
  | "preview.single"
  | "preview.batch";

/** Remote MCP tool invoked for a logical role. */
export interface MappedToolDefinition {
  /** Value passed to JSON-RPC `tools/call` `params.name`. */
  toolName: string;
  /** Optional hint for plugin UI or diagnostics. */
  description?: string;
}

/** Role → remote tool mapping (JSON-serializable). `catalog.list` is mandatory. */
export type ComponentSourceToolMapping = {
  "catalog.list": MappedToolDefinition;
} & Partial<Record<Exclude<ComponentSourceRole, "catalog.list">, MappedToolDefinition>>;

/** Optional capabilities inferred from a tool mapping or health probe. */
export interface ComponentSourceCapabilities {
  catalog: {
    list: true;
    search?: boolean;
    resolve?: boolean;
    get?: boolean;
    props?: boolean;
    recipe?: boolean;
    health?: boolean;
  };
  designSystem?: {
    get?: boolean;
    styleRules?: boolean;
  };
  preview?: {
    single?: boolean;
    batch?: boolean;
  };
}

/** Derives {@link ComponentSourceCapabilities} from a role mapping object. */
export function inferCapabilitiesFromMapping(
  mapping: ComponentSourceToolMapping,
): ComponentSourceCapabilities {
  const has = (role: ComponentSourceRole): boolean =>
    Boolean(mapping[role]?.toolName?.trim());

  return {
    catalog: {
      list: true,
      search: has("catalog.search"),
      resolve: has("catalog.resolve"),
      get: has("catalog.get"),
      props: has("catalog.props"),
      recipe: has("catalog.recipe"),
      health: has("catalog.health"),
    },
    ...(has("designSystem.get") || has("designSystem.styleRules")
      ? {
          designSystem: {
            get: has("designSystem.get"),
            styleRules: has("designSystem.styleRules"),
          },
        }
      : {}),
    ...(has("preview.single") || has("preview.batch")
      ? {
          preview: {
            single: has("preview.single"),
            batch: has("preview.batch"),
          },
        }
      : {}),
  };
}
