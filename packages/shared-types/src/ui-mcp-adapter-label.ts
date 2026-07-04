/** Id del adaptador semántico genérico (MCPs con resolve_component_for_entity + catálogo). */
export const UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID = "semantic-catalog";

/** Alias legacy persistido antes del refactor vendor-agnóstico. */
export const UI_MCP_LEGACY_KREO_ADAPTER_ID = "kreo";

const ADAPTER_LABELS: Record<string, string> = {
  [UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID]: "Catálogo semántico",
  [UI_MCP_LEGACY_KREO_ADAPTER_ID]: "Catálogo semántico",
};

/** Etiqueta legible para UI (Ajustes › MCP gráfico, toasts de detección). */
export function getUiMcpAdapterLabel(adapterId: string | null | undefined): string | null {
  if (!adapterId?.trim()) return null;
  const id = adapterId.trim();
  if (ADAPTER_LABELS[id]) return ADAPTER_LABELS[id];
  return id;
}
