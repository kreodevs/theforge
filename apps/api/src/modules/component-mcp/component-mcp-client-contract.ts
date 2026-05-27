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

export interface ProductionSnippet {
  code: string;
  componentName?: string;
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
