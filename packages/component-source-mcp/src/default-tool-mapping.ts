import type { ComponentSourceToolMapping } from "@theforge/component-source";

/** Default IMJ / Orbita-style MCP tool names for the generic catalog port. */
export const DEFAULT_MCP_TOOL_MAPPING: ComponentSourceToolMapping = {
  "catalog.list": { toolName: "list_modules", description: "List catalog modules" },
  "catalog.search": { toolName: "search_modules", description: "Search catalog modules" },
  "catalog.resolve": { toolName: "resolve_components", description: "Resolve component names" },
  "catalog.get": { toolName: "get_component", description: "Fetch component source" },
  "catalog.props": { toolName: "get_props", description: "Fetch component props schema" },
  "catalog.recipe": { toolName: "get_composition_recipe", description: "Fetch composition recipe" },
  "catalog.health": { toolName: "catalog_health", description: "Catalog health probe" },
  "designSystem.get": { toolName: "get_design_system", description: "Design system tokens and context" },
  "designSystem.styleRules": { toolName: "get_style_rules", description: "Style rules checklist" },
  "preview.single": { toolName: "get_component_preview", description: "Hosted preview for one component" },
  "preview.batch": { toolName: "get_component_previews", description: "Hosted previews batch" },
};
