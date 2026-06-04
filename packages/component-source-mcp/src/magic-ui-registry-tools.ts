export const MAGIC_UI_LIST_TOOL = /^listRegistryItems$/i;
export const MAGIC_UI_SEARCH_TOOL = /^searchRegistryItems$/i;
export const MAGIC_UI_GET_TOOL = /^getRegistryItem$/i;

export const MAGIC_UI_LIST_LIMIT = 150;

export function isMagicUiListTool(toolName: string): boolean {
  return MAGIC_UI_LIST_TOOL.test(toolName.trim());
}

export function isMagicUiSearchTool(toolName: string): boolean {
  return MAGIC_UI_SEARCH_TOOL.test(toolName.trim());
}

export function isMagicUiGetTool(toolName: string): boolean {
  return MAGIC_UI_GET_TOOL.test(toolName.trim());
}

export function buildMagicUiListModulesArgs(toolName: string): Record<string, unknown> {
  if (isMagicUiListTool(toolName)) {
    return { limit: MAGIC_UI_LIST_LIMIT };
  }
  return {};
}

export function buildMagicUiSearchModulesArgs(
  toolName: string,
  query: string,
): Record<string, unknown> {
  if (isMagicUiSearchTool(toolName)) {
    return { query, limit: 100 };
  }
  return { query };
}

export function buildMagicUiGetComponentArgs(
  toolName: string,
  moduleId: string,
  exportName?: string,
): Record<string, unknown> {
  if (isMagicUiGetTool(toolName)) {
    return { name: moduleId };
  }
  return {
    moduleId,
    ...(exportName ? { exportName } : {}),
  };
}
