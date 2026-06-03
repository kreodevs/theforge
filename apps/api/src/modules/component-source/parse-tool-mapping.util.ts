import type { ComponentSourceRole, ComponentSourceToolMapping } from "@theforge/component-source";

const OPTIONAL_ROLES: Exclude<ComponentSourceRole, "catalog.list">[] = [
  "catalog.search",
  "catalog.resolve",
  "catalog.get",
  "catalog.props",
  "catalog.recipe",
  "catalog.health",
  "designSystem.get",
  "designSystem.styleRules",
  "preview.single",
  "preview.batch",
];

function readMappedTool(entry: unknown): { toolName: string; description?: string } | null {
  if (!entry || typeof entry !== "object") return null;
  const toolName = (entry as { toolName?: unknown }).toolName;
  if (typeof toolName !== "string" || !toolName.trim()) return null;
  const description = (entry as { description?: unknown }).description;
  return {
    toolName: toolName.trim(),
    ...(typeof description === "string" && description.trim()
      ? { description: description.trim() }
      : {}),
  };
}

/** Parses persisted profile JSON into a validated tool mapping (`catalog.list` required). */
export function parseToolMappingFromJson(value: unknown): ComponentSourceToolMapping | null {
  if (!value || typeof value !== "object") return null;

  const catalogList = readMappedTool((value as Record<string, unknown>)["catalog.list"]);
  if (!catalogList) return null;

  const mapping: ComponentSourceToolMapping = {
    "catalog.list": catalogList,
  };

  for (const role of OPTIONAL_ROLES) {
    const mapped = readMappedTool((value as Record<string, unknown>)[role]);
    if (mapped) mapping[role] = mapped;
  }

  return mapping;
}

/** True when profile mapping is confirmed and includes mandatory catalog.list. */
export function isConfirmedToolMapping(
  mappingConfirmedAt: Date | null | undefined,
  toolMapping: unknown,
): boolean {
  if (!mappingConfirmedAt) return false;
  return parseToolMappingFromJson(toolMapping) !== null;
}
