/**
 * @fileoverview Registro de adaptadores UI MCP — matching por `tools/list`.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import {
  getUiMcpAdapterLabel as sharedGetUiMcpAdapterLabel,
  UI_MCP_LEGACY_KREO_ADAPTER_ID,
  UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID,
} from "@theforge/shared-types";
import {
  createSemanticCatalogAdapter,
  semanticCatalogUiMcpAdapterDefinition,
} from "./semantic-catalog-ui-mcp.adapter.js";
import type { UiMcpAdapter } from "./ui-mcp-adapter.types.js";

export {
  UI_MCP_LEGACY_KREO_ADAPTER_ID as LEGACY_KREO_ADAPTER_ID,
  UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID as SEMANTIC_CATALOG_ADAPTER_ID,
} from "@theforge/shared-types";

interface AdapterDefinition {
  id: string;
  label: string;
  requiredTools: readonly string[];
  create: (toolNames: string[]) => UiMcpAdapter;
}

const ADAPTER_DEFINITIONS: AdapterDefinition[] = [
  {
    ...semanticCatalogUiMcpAdapterDefinition,
    create: createSemanticCatalogAdapter,
  },
];

function hasAllTools(available: Set<string>, required: readonly string[]): boolean {
  return required.every((t) => available.has(t));
}

function normalizeAdapterId(adapterId: string): string {
  return adapterId === UI_MCP_LEGACY_KREO_ADAPTER_ID
    ? UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID
    : adapterId;
}

/**
 * Si el MCP no implementa el contrato nativo, intenta emparejar un adaptador genérico
 * por intersección de tools expuestos.
 */
export function matchUiMcpAdapter(toolNames: string[]): UiMcpAdapter | null {
  const available = new Set(toolNames);
  for (const def of ADAPTER_DEFINITIONS) {
    if (hasAllTools(available, def.requiredTools)) {
      return def.create(toolNames);
    }
  }
  return null;
}

/** Rehidrata un adaptador persistido por `adapterId` + tools detectados en capabilitiesJson. */
export function resolveUiMcpAdapterById(
  adapterId: string,
  toolNames: string[],
): UiMcpAdapter | null {
  const normalized = normalizeAdapterId(adapterId);
  const def = ADAPTER_DEFINITIONS.find((d) => d.id === normalized);
  if (!def) return null;
  const tools = toolNames.length > 0 ? toolNames : [...def.requiredTools];
  return def.create(tools);
}

/** Etiqueta legible del adaptador (para UI). */
export function getUiMcpAdapterLabel(adapterId: string | null | undefined): string | null {
  return sharedGetUiMcpAdapterLabel(adapterId);
}
