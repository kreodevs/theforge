/**
 * @fileoverview Adaptador Kreo UI MCP → contrato UI The Forge.
 *
 * Mapea tools Kreo (`resolve_component_for_entity`, `get_ui_component_catalog`, …)
 * al contrato nativo (`resolve_component`, `list_components`, `describe_capabilities`, …).
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
  parseKreoCatalogComponentNames,
} from "../ui-mcp-mcp-text.util.js";
import { callUiMcpToolText, type UiMcpConnection } from "../ui-mcp-transport.util.js";
import type { UiMcpAdapter } from "./ui-mcp-adapter.types.js";

const KREO_LIBRARY = { name: "kreo-ui", version: "5.3" } as const;

const CLASSIFICATION_TO_ENTITY_TYPE: Record<EntityClassification, string> = {
  WorkflowProcess: "Workflow/Pipeline",
  DataRegistry: "Listado plano",
  Configuration: "Configuración",
};

interface KreoResolvePayload {
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

function mapKreoResolve(raw: KreoResolvePayload): ResolveComponentResult {
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

async function callKreoText(
  conn: UiMcpConnection,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<string | null> {
  return callUiMcpToolText(conn, toolName, args);
}

/** Capacidades sintetizadas a partir de `tools/list` (sin round-trip remoto). */
export function buildKreoCapabilities(toolNames: string[]): DescribeCapabilitiesResult {
  return {
    contractVersion: UI_MCP_CONTRACT_VERSION,
    componentLibrary: { ...KREO_LIBRARY },
    supports: {
      resolveComponent: true,
      listScreens: toolNames.includes("list_ui_project_screens"),
      designTokens: toolNames.includes("pull_tokens_dtcg"),
    },
    meta: { adapter: "kreo", nativeContract: false },
  };
}

const kreoRuntimeAdapter: Omit<UiMcpAdapter, "describeCapabilities"> = {
  id: "kreo",
  label: "Kreo UI MCP",
  requiredTools: ["resolve_component_for_entity", "get_ui_component_catalog"],

  async listComponents(conn): Promise<ListComponentsResult> {
    const text = await callKreoText(conn, "get_ui_component_catalog", { generatableOnly: true });
    if (!text) return { components: [] };
    const names = parseKreoCatalogComponentNames(text);
    const components: UiComponentDescriptor[] = names.map((name) => ({
      name,
      package: `@/components/**/${name}`,
      version: "registry",
      replacesGeneric: [],
      semantic: { classification: [], capabilities: [] },
      props: [],
      description: "Catálogo Kreo UI (adaptador)",
    }));
    return { components };
  },

  async resolveComponent(conn, args): Promise<ResolveComponentResult> {
    const entityType = args.classification
      ? CLASSIFICATION_TO_ENTITY_TYPE[args.classification]
      : undefined;
    const text = await callKreoText(conn, "resolve_component_for_entity", {
      entity_name: args.entityName,
      entity_type: entityType,
      properties: args.keyFields?.map((name) => ({ name, type: "string" })),
    });
    if (!text) throw new Error("resolve_component_for_entity sin respuesta");
    const raw = extractJsonFromMcpText(text) as KreoResolvePayload | null;
    if (!raw?.component_name) throw new Error("resolve_component_for_entity: JSON inválido");
    return mapKreoResolve(raw);
  },

  async getDesignTokens(conn): Promise<GetDesignTokensResult | null> {
    const text = await callKreoText(conn, "pull_tokens_dtcg", { confirm: true });
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

/** Instancia del adaptador Kreo con `describeCapabilities` acoplado a los tools detectados. */
export function createKreoAdapter(toolNames: string[]): UiMcpAdapter {
  return {
    ...kreoRuntimeAdapter,
    async describeCapabilities(_conn) {
      return buildKreoCapabilities(toolNames);
    },
  };
}

/** Definición estática para matching (sin estado). */
export const kreoUiMcpAdapterDefinition = {
  id: kreoRuntimeAdapter.id,
  label: kreoRuntimeAdapter.label,
  requiredTools: kreoRuntimeAdapter.requiredTools,
};
