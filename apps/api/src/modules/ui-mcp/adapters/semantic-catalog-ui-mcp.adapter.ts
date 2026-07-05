/**
 * @fileoverview Adaptador genérico para MCPs UI con contrato semántico extendido.
 *
 * Cualquier MCP gráfico que exponga (mínimo):
 * - `resolve_component_for_entity`
 * - `get_ui_component_catalog`
 *
 * se empareja por tools/list sin hardcode de vendor (Kreo u otro).
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import type {
  DescribeCapabilitiesResult,
  EntityClassification,
  GetDesignTokensResult,
  ListComponentsResult,
  ResolveComponentResult,
  UiComponentDescriptor,
} from "@theforge/shared-types";
import { UI_MCP_CONTRACT_VERSION } from "@theforge/shared-types";
import {
  extractJsonFromMcpText,
  parseCatalogTableComponentNames,
} from "../ui-mcp-mcp-text.util.js";
import { callUiMcpToolText, type UiMcpConnection } from "../ui-mcp-transport.util.js";
import type { UiMcpAdapter } from "./ui-mcp-adapter.types.js";

import { UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID } from "@theforge/shared-types";

const DEFAULT_LIBRARY = { name: "ui-component-mcp", version: "1.0" } as const;

const CLASSIFICATION_TO_ENTITY_TYPE: Record<EntityClassification, string> = {
  WorkflowProcess: "Workflow/Pipeline",
  DataRegistry: "Listado plano",
  Configuration: "Configuración",
};

interface SemanticResolvePayload {
  component_name?: string;
  path?: string;
  required_props?: Array<{
    name?: string;
    type?: string;
    required?: boolean;
    description?: string;
  }>;
  rationale?: string;
}

interface DtcgTokenLeaf {
  $value?: unknown;
  $type?: string;
}

export interface SemanticCatalogAdapterOptions {
  libraryName?: string;
  libraryVersion?: string;
}

function flatDtcgSection(
  section: Record<string, DtcgTokenLeaf> | undefined,
): Record<string, string> {
  if (!section) return {};
  const out: Record<string, string> = {};
  for (const [key, leaf] of Object.entries(section)) {
    const v = leaf?.$value;
    if (v == null) continue;
    out[key] = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return out;
}

function mapSemanticResolve(raw: SemanticResolvePayload): ResolveComponentResult {
  const component = raw.component_name?.trim() || "Card";
  const importPath = raw.path?.trim() || "@/components/molecules/Card";
  const propMapping: Record<string, string> = {};
  for (const p of raw.required_props ?? []) {
    if (p.name) propMapping[p.name] = p.description ?? p.type ?? "required";
  }
  return {
    component,
    package: importPath,
    version: "registry",
    propMapping,
    confidence: 0.92,
    note: raw.rationale,
  };
}

async function callSemanticTool(
  conn: UiMcpConnection,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<string | null> {
  return callUiMcpToolText(conn, toolName, args);
}

/** Capacidades sintetizadas a partir de `tools/list` (sin round-trip remoto). */
export function buildSemanticCatalogCapabilities(
  toolNames: string[],
  options: SemanticCatalogAdapterOptions = {},
): DescribeCapabilitiesResult {
  return {
    contractVersion: UI_MCP_CONTRACT_VERSION,
    componentLibrary: {
      name: options.libraryName ?? DEFAULT_LIBRARY.name,
      version: options.libraryVersion ?? DEFAULT_LIBRARY.version,
    },
    supports: {
      resolveComponent: true,
      listScreens: toolNames.includes("list_ui_project_screens"),
      designTokens: toolNames.includes("pull_tokens_dtcg") || toolNames.includes("get_design_tokens"),
    },
    meta: {
      adapter: UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID,
      nativeContract: false,
      protocol: "resolve_component_for_entity",
    },
  };
}

const semanticCatalogRuntimeAdapter: Omit<UiMcpAdapter, "describeCapabilities"> = {
  id: UI_MCP_SEMANTIC_CATALOG_ADAPTER_ID,
  label: "MCP UI (catálogo semántico)",
  requiredTools: ["resolve_component_for_entity", "get_ui_component_catalog"],

  async listComponents(conn): Promise<ListComponentsResult> {
    const text = await callSemanticTool(conn, "get_ui_component_catalog", { generatableOnly: true });
    if (!text) return { components: [] };
    const names = parseCatalogTableComponentNames(text);
    const components: UiComponentDescriptor[] = names.map((name) => ({
      name,
      package: `@/components/**/${name}`,
      version: "registry",
      replacesGeneric: [],
      semantic: { classification: [], capabilities: [] },
      props: [],
      description: "Catálogo MCP gráfico (adaptador semántico)",
    }));
    return { components };
  },

  async resolveComponent(conn, args): Promise<ResolveComponentResult> {
    const entityType = args.classification
      ? CLASSIFICATION_TO_ENTITY_TYPE[args.classification]
      : undefined;
    const text = await callSemanticTool(conn, "resolve_component_for_entity", {
      entity_name: args.entityName,
      entity_type: entityType,
      ui_hint: args.uiHint,
      context: args.context,
      properties: args.keyFields?.map((name) => ({ name, type: "string" })),
    });
    if (!text) throw new Error("resolve_component_for_entity sin respuesta");
    const raw = extractJsonFromMcpText(text) as SemanticResolvePayload | null;
    if (!raw?.component_name) throw new Error("resolve_component_for_entity: JSON inválido");
    return mapSemanticResolve(raw);
  },

  async getDesignTokens(conn): Promise<GetDesignTokensResult | null> {
    const dtcg = await callSemanticTool(conn, "pull_tokens_dtcg", { confirm: true });
    const text =
      dtcg ??
      (await callSemanticTool(conn, "get_design_tokens", {}));
    if (!text) return null;
    const raw = extractJsonFromMcpText(text) as Record<string, Record<string, DtcgTokenLeaf>> | null;
    if (!raw) return null;
    return {
      colors: flatDtcgSection(raw.color),
      typography: flatDtcgSection(raw.typography),
      spacing: flatDtcgSection(raw.spacing),
      radii: flatDtcgSection(raw["border-radius"]),
      shadows: flatDtcgSection(raw.shadow),
      raw,
    };
  },
};

/** Instancia del adaptador semántico con capacidades acopladas a tools detectados. */
export function createSemanticCatalogAdapter(
  toolNames: string[],
  options: SemanticCatalogAdapterOptions = {},
): UiMcpAdapter {
  return {
    ...semanticCatalogRuntimeAdapter,
    async describeCapabilities(_conn) {
      return buildSemanticCatalogCapabilities(toolNames, options);
    },
  };
}

export const semanticCatalogUiMcpAdapterDefinition = {
  id: semanticCatalogRuntimeAdapter.id,
  label: semanticCatalogRuntimeAdapter.label,
  requiredTools: semanticCatalogRuntimeAdapter.requiredTools,
};
