import type {
  CatalogHealthResult,
  ComponentCode,
  ComponentHealthCheck,
  ComponentModule,
  ComponentPreviewArgs,
  ComponentPreviewsBatchArgs,
  ComponentPreviewsBatchResult,
  ComponentProps,
  ComponentResolution,
  ComponentSourceCapabilities,
  CompositionRecipe,
  DesignSystemResult,
  GetDesignSystemArgs,
  HostedPreviewPayload,
  McpToolResult,
  StyleRule,
} from "./types.js";

/**
 * Public surface of a component design-system source (aligned with ComponentMcpService).
 */
export interface ComponentSourcePort {
  /** Optional capabilities inferred from profile tool mapping (MappedMcpComponentSource). */
  readonly capabilities?: ComponentSourceCapabilities;
  searchModules(userId: string, query: string): Promise<McpToolResult<ComponentModule[]>>;

  resolveComponents(
    userId: string,
    names: string[],
  ): Promise<McpToolResult<{ results: ComponentResolution[] }>>;

  getComponent(
    userId: string,
    moduleId: string,
    exportName?: string,
  ): Promise<McpToolResult<ComponentCode>>;

  getProps(
    userId: string,
    moduleId: string,
    exportName?: string,
  ): Promise<McpToolResult<ComponentProps>>;

  getCompositionRecipe(
    userId: string,
    moduleId: string,
  ): Promise<McpToolResult<CompositionRecipe>>;

  listModules(userId: string): Promise<McpToolResult<ComponentModule[]>>;

  catalogHealth(userId: string): Promise<McpToolResult<CatalogHealthResult>>;

  getStyleRules(userId: string): Promise<McpToolResult<StyleRule[]>>;

  getDesignSystem(
    userId: string,
    args?: GetDesignSystemArgs,
  ): Promise<McpToolResult<DesignSystemResult>>;

  getComponentPreview(
    userId: string,
    args: ComponentPreviewArgs,
  ): Promise<McpToolResult<HostedPreviewPayload>>;

  getComponentPreviews(
    userId: string,
    args: ComponentPreviewsBatchArgs,
  ): Promise<McpToolResult<ComponentPreviewsBatchResult>>;

  checkHealth(userId: string): Promise<ComponentHealthCheck>;
}
