/**
 * @fileoverview Registro de adaptadores UI MCP — matching por `tools/list`.
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { createKreoAdapter, kreoUiMcpAdapterDefinition } from "./kreo-ui-mcp.adapter.js";
import type { UiMcpAdapter } from "./ui-mcp-adapter.types.js";

interface AdapterDefinition {
  id: string;
  label: string;
  requiredTools: readonly string[];
  create: (toolNames: string[]) => UiMcpAdapter;
}

const ADAPTER_DEFINITIONS: AdapterDefinition[] = [
  {
    ...kreoUiMcpAdapterDefinition,
    create: createKreoAdapter,
  },
];

function hasAllTools(available: Set<string>, required: readonly string[]): boolean {
  return required.every((t) => available.has(t));
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

/** Etiqueta legible del adaptador (para UI). */
export function getUiMcpAdapterLabel(adapterId: string | null | undefined): string | null {
  if (!adapterId) return null;
  const def = ADAPTER_DEFINITIONS.find((d) => d.id === adapterId);
  return def?.label ?? adapterId;
}
