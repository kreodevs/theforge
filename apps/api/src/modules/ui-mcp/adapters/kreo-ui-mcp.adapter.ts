/**
 * @fileoverview Alias legacy del adaptador semántico genérico.
 *
 * Kreo UI MCP implementa el contrato semántico extendido; no requiere adaptador propio.
 * Este módulo se mantiene por compatibilidad de imports/tests históricos.
 *
 * @deprecated Importar desde `semantic-catalog-ui-mcp.adapter.ts`.
 */
export {
  buildSemanticCatalogCapabilities as buildKreoCapabilities,
  createSemanticCatalogAdapter as createKreoAdapter,
  semanticCatalogUiMcpAdapterDefinition as kreoUiMcpAdapterDefinition,
} from "./semantic-catalog-ui-mcp.adapter.js";
export {
  UI_MCP_LEGACY_KREO_ADAPTER_ID as LEGACY_KREO_ADAPTER_ID,
  UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID as SEMANTIC_CATALOG_ADAPTER_ID,
} from "@theforge/shared-types";
