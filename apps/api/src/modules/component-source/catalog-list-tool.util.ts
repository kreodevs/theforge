/** Tools that return docs or repo search hits — never valid for catalog.list. */
const DISALLOWED_CATALOG_LIST_TOOL =
  /^(fetch_.*(documentation|docs?)|search_.*(documentation|docs?|code|ui)|get_.*(documentation|docs?))$/i;

const PREFERRED_CATALOG_LIST_PATTERNS = [
  /^list_modules$/i,
  /^listRegistryItems$/i,
  /^list_items_in_registries$/i,
  /^list_components$/i,
  /^list_.*modules?$/i,
  /^list_.*components?$/i,
  /^list_.*registr/i,
  /^catalog[_\.]list$/i,
  /^get_catalog$/i,
  /^list_catalog$/i,
  /^list_/i,
];

export function isDisallowedCatalogListTool(toolName: string): boolean {
  const normalized = toolName.trim();
  if (!normalized) return true;
  return DISALLOWED_CATALOG_LIST_TOOL.test(normalized);
}

export function pickBestCatalogListTool(toolNames: string[]): string | null {
  const allowed = toolNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !isDisallowedCatalogListTool(name));
  if (allowed.length === 0) return null;

  for (const pattern of PREFERRED_CATALOG_LIST_PATTERNS) {
    const match = allowed.find((name) => pattern.test(name));
    if (match) return match;
  }

  return allowed[0] ?? null;
}

export type ResolveCatalogListToolResult =
  | { ok: true; toolName: string; correctedFrom?: string }
  | { ok: false; reason: string };

/** Picks catalog.list tool: keeps valid LLM choice or falls back to heuristic. */
export function resolveCatalogListToolName(
  proposed: string | undefined,
  availableToolNames: string[],
): ResolveCatalogListToolResult {
  const available = new Set(availableToolNames.map((n) => n.trim()).filter(Boolean));
  const trimmed = proposed?.trim();

  if (trimmed && !isDisallowedCatalogListTool(trimmed) && available.has(trimmed)) {
    return { ok: true, toolName: trimmed };
  }

  const fallback = pickBestCatalogListTool([...available]);
  if (fallback) {
    return {
      ok: true,
      toolName: fallback,
      ...(trimmed && trimmed !== fallback ? { correctedFrom: trimmed } : {}),
    };
  }

  if (trimmed && isDisallowedCatalogListTool(trimmed)) {
    return {
      ok: false,
      reason: `catalog.list no puede usar "${trimmed}": es documentación o búsqueda en repo, no un catálogo de módulos DS.`,
    };
  }

  const onlyDocTools = availableToolNames.every((name) => isDisallowedCatalogListTool(name));
  if (onlyDocTools && availableToolNames.length > 0) {
    return {
      ok: false,
      reason:
        "Este MCP no expone catálogo de módulos (solo documentación o búsqueda en repo, p. ej. GitMCP). Usa un MCP con list_modules (Orbita/IMJ) o list_items_in_registries (shadcn oficial).",
    };
  }

  return {
    ok: false,
    reason:
      "El mapeo debe incluir catalog.list con toolName. No se encontró herramienta de listado en el MCP.",
  };
}
