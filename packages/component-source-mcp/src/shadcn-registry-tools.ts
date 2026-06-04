import type { ComponentSourceToolMapping } from "@theforge/component-source";

/** shadcn/ui MCP tools that require a `registries` string array. */
export const SHADCN_REGISTRY_LIST_TOOL = /^list_items_in_registries$/i;
export const SHADCN_REGISTRY_SEARCH_TOOL = /^search_items_in_registries$/i;
export const SHADCN_REGISTRY_VIEW_TOOL = /^view_items_in_registries$/i;
export const SHADCN_REGISTRY_EXAMPLES_TOOL = /^get_item_examples_from_registries$/i;
export const SHADCN_PROJECT_REGISTRIES_TOOL = /^get_project_registries$/i;

export const SHADCN_DEFAULT_REGISTRIES = ["@shadcn"] as const;

export function isShadcnRegistryListTool(toolName: string): boolean {
  return SHADCN_REGISTRY_LIST_TOOL.test(toolName.trim());
}

export function isShadcnRegistrySearchTool(toolName: string): boolean {
  return SHADCN_REGISTRY_SEARCH_TOOL.test(toolName.trim());
}

export function isShadcnRegistryViewTool(toolName: string): boolean {
  return SHADCN_REGISTRY_VIEW_TOOL.test(toolName.trim());
}

export function isShadcnRegistryExamplesTool(toolName: string): boolean {
  return SHADCN_REGISTRY_EXAMPLES_TOOL.test(toolName.trim());
}

/** Parses `get_project_registries` markdown bullet list into registry names. */
export function parseRegistriesFromProjectRegistriesText(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/^-\s+(@[\w-]+)/gm)) {
    names.add(match[1]!);
  }
  return [...names];
}

export function resolveShadcnProjectRegistriesToolName(
  mapping: ComponentSourceToolMapping,
): string {
  const fromDesignSystem = mapping["designSystem.get"]?.toolName?.trim();
  if (fromDesignSystem && SHADCN_PROJECT_REGISTRIES_TOOL.test(fromDesignSystem)) {
    return fromDesignSystem;
  }
  return "get_project_registries";
}

export function buildShadcnListModulesArgs(
  toolName: string,
  registries: string[],
): Record<string, unknown> {
  if (isShadcnRegistryListTool(toolName)) {
    return { registries, limit: 1000 };
  }
  return {};
}

export function buildShadcnSearchModulesArgs(
  toolName: string,
  registries: string[],
  query: string,
): Record<string, unknown> {
  if (isShadcnRegistrySearchTool(toolName)) {
    return { registries, query, limit: 100 };
  }
  return { query };
}

/** Maps plain component ids to shadcn registry item keys (`@shadcn/button`). */
export function toShadcnRegistryItems(names: string[], registryPrefix = "@shadcn"): string[] {
  const prefix = registryPrefix.startsWith("@") ? registryPrefix : `@${registryPrefix}`;
  return names.map((name) => {
    const trimmed = name.trim();
    if (!trimmed) return trimmed;
    if (trimmed.includes("/")) return trimmed;
    return `${prefix}/${trimmed}`;
  });
}

export function buildShadcnViewItemsArgs(
  toolName: string,
  names: string[],
  registries: string[],
): Record<string, unknown> {
  if (!isShadcnRegistryViewTool(toolName)) {
    return { names };
  }
  const prefix = registries[0] ?? SHADCN_DEFAULT_REGISTRIES[0];
  return { items: toShadcnRegistryItems(names, prefix) };
}

export function buildShadcnExamplesArgs(
  toolName: string,
  moduleId: string,
  registries: string[],
): Record<string, unknown> {
  if (!isShadcnRegistryExamplesTool(toolName)) {
    return { moduleId };
  }
  const query = moduleId.includes("/") ? moduleId.split("/").pop() ?? moduleId : moduleId;
  return { registries, query };
}
