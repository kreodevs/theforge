/** Capabilities inferred from MCP tool mapping (mirrors @theforge/component-source). */
export interface ComponentSourceCapabilities {
  catalog: {
    list: true;
    search?: boolean;
    resolve?: boolean;
    get?: boolean;
    props?: boolean;
    recipe?: boolean;
    health?: boolean;
  };
  designSystem?: {
    get?: boolean;
    styleRules?: boolean;
  };
  preview?: {
    single?: boolean;
    batch?: boolean;
  };
}

export type ComponentSourceTransportType = "http" | "stdio";

export interface ComponentSourceProfileSummary {
  id: string;
  name: string;
  /** Backend normalizes legacy ids to `mcp`. */
  pluginId: string;
  transportType?: ComponentSourceTransportType;
  url: string;
  command?: string | null;
  args?: string[] | null;
  cwd?: string | null;
  hasToken: boolean;
  capabilities?: ComponentSourceCapabilities | null;
  toolMapping?: Record<string, unknown> | null;
  mappedAt?: string | null;
  mappingConfirmedAt?: string | null;
  /** Projects referencing this profile (delete guard). */
  projectCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertComponentSourceProfileBody {
  name: string;
  transportType?: ComponentSourceTransportType;
  url?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  token?: string;
  /** Omitted in UI — backend defaults to generic MCP plugin. */
  pluginId?: string;
}

export interface ComponentSourceRegenerationStep {
  step: number;
  totalSteps: number;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
  durationMs?: number;
}

export type CapabilityTone = "green" | "amber" | "red";

export interface CapabilityRoleItem {
  id: string;
  label: string;
  required: boolean;
  isPresent: (caps: ComponentSourceCapabilities | null | undefined) => boolean;
}

/** User-facing capability rows for {@link CapabilityStatusBox}. */
export const COMPONENT_SOURCE_CAPABILITY_ROLES: CapabilityRoleItem[] = [
  {
    id: "catalog.list",
    label: "Catálogo (list)",
    required: true,
    isPresent: (caps) => caps?.catalog?.list === true,
  },
  {
    id: "catalog.search",
    label: "Búsqueda",
    required: false,
    isPresent: (caps) => caps?.catalog?.search === true,
  },
  {
    id: "catalog.resolve",
    label: "Resolución",
    required: false,
    isPresent: (caps) => caps?.catalog?.resolve === true,
  },
  {
    id: "catalog.get",
    label: "Detalle componente",
    required: false,
    isPresent: (caps) => caps?.catalog?.get === true,
  },
  {
    id: "catalog.props",
    label: "Props",
    required: false,
    isPresent: (caps) => caps?.catalog?.props === true,
  },
  {
    id: "catalog.recipe",
    label: "Recetas composición",
    required: false,
    isPresent: (caps) => caps?.catalog?.recipe === true,
  },
  {
    id: "catalog.health",
    label: "Salud catálogo",
    required: false,
    isPresent: (caps) => caps?.catalog?.health === true,
  },
  {
    id: "designSystem.get",
    label: "Design system",
    required: false,
    isPresent: (caps) => caps?.designSystem?.get === true,
  },
  {
    id: "designSystem.styleRules",
    label: "Reglas de estilo",
    required: false,
    isPresent: (caps) => caps?.designSystem?.styleRules === true,
  },
  {
    id: "preview.single",
    label: "Preview unitario",
    required: false,
    isPresent: (caps) => caps?.preview?.single === true,
  },
  {
    id: "preview.batch",
    label: "Preview batch",
    required: false,
    isPresent: (caps) => caps?.preview?.batch === true,
  },
];

export function capabilityToneForRole(
  role: CapabilityRoleItem,
  caps: ComponentSourceCapabilities | null | undefined,
  mappingPending: boolean,
): CapabilityTone {
  const present = role.isPresent(caps);
  if (role.required) {
    if (present) return "green";
    return mappingPending ? "amber" : "red";
  }
  return present ? "green" : "amber";
}

/** Placeholder structure until mapping API persists capabilities. */
export function placeholderCapabilities(): ComponentSourceCapabilities {
  return {
    catalog: { list: true },
    designSystem: {},
    preview: {},
  };
}

/** Proposed role → tool mapping returned by POST …/profiles/:id/test when mode=mapping. */
export type ComponentSourceProposedToolMapping = Record<
  string,
  { toolName: string; description?: string }
>;

export type ComponentSourceCatalogProbe = {
  ok: boolean;
  moduleCount: number;
  shape: string;
  preview: string;
  reason?: string;
};

export type ComponentSourceProfileTestResult =
  | { ok: true; mode: "health"; service?: string }
  | {
      ok: true;
      mode: "mapping";
      proposedMapping: ComponentSourceProposedToolMapping;
      capabilities?: ComponentSourceCapabilities;
      toolsListHash?: string;
      catalogProbe?: ComponentSourceCatalogProbe;
    }
  | { ok: false; error: string };

export interface ProjectComponentSourceProfileAssignment {
  profileId: string | null;
  profile: ComponentSourceProfileSummary | null;
}

/** True when the profile has enough config to attempt an MCP connection (Bearer token optional). */
export function profileHasConnectionConfig(
  profile: ComponentSourceProfileSummary | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.transportType === "stdio") {
    return Boolean(profile.command?.trim());
  }
  return Boolean(profile.url?.trim());
}

export function isStdioComponentSourceProfile(
  profile: ComponentSourceProfileSummary | null | undefined,
): boolean {
  return profile?.transportType === "stdio";
}

const DISALLOWED_CATALOG_LIST_TOOL =
  /^(fetch_.*(documentation|docs?)|search_.*(documentation|docs?|code|ui)|get_.*(documentation|docs?))$/i;

export function isDisallowedCatalogListToolName(toolName: string): boolean {
  const normalized = toolName.trim();
  return normalized.length > 0 && DISALLOWED_CATALOG_LIST_TOOL.test(normalized);
}

/** Whether the profile has a user-confirmed tool mapping with mandatory catalog.list. */
export function hasConfirmedCatalogMapping(
  profile: ComponentSourceProfileSummary | null | undefined,
): boolean {
  if (!profile?.mappingConfirmedAt) return false;
  const mapping = profile.toolMapping;
  if (!mapping || typeof mapping !== "object") return false;
  const list = (mapping as Record<string, unknown>)["catalog.list"];
  if (!list || typeof list !== "object") return false;
  const toolName = (list as { toolName?: unknown }).toolName;
  if (typeof toolName !== "string" || !toolName.trim()) return false;
  if (isDisallowedCatalogListToolName(toolName)) return false;
  if (profile.capabilities?.catalog?.list === true) return true;
  return true;
}

export function formatProposedMappingSummary(
  mapping: ComponentSourceProposedToolMapping,
): Array<{ role: string; toolName: string; description?: string }> {
  return Object.entries(mapping)
    .filter(([, v]) => typeof v?.toolName === "string" && v.toolName.trim())
    .map(([role, v]) => ({
      role,
      toolName: v.toolName.trim(),
      description: v.description?.trim() || undefined,
    }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

export type ProjectMcpWireframeGate =
  | { ready: true }
  | { ready: false; reason: "no-profile" | "profile-missing" | "mapping-unconfirmed" | "credentials" };

/** Gate for wireframe generation: profile selected + confirmed catalog.list mapping. */
export function getProjectWireframeMcpGate(
  project: { componentSourceProfileId?: string | null } | null,
  profiles: ComponentSourceProfileSummary[],
): ProjectMcpWireframeGate {
  if (!project) return { ready: false, reason: "no-profile" };
  const profileId = project.componentSourceProfileId?.trim();
  if (!profileId) return { ready: false, reason: "no-profile" };
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return { ready: false, reason: "profile-missing" };
  if (!profileHasConnectionConfig(profile)) return { ready: false, reason: "credentials" };
  if (!hasConfirmedCatalogMapping(profile)) return { ready: false, reason: "mapping-unconfirmed" };
  return { ready: true };
}

export function wireframeMcpGateMessage(gate: ProjectMcpWireframeGate): string {
  if (gate.ready) return "";
  switch (gate.reason) {
    case "no-profile":
      return "Selecciona un perfil MCP en la pestaña Design System (Ajustes → Componentes para crear uno).";
    case "profile-missing":
      return "El perfil MCP asignado ya no existe. Elige otro perfil en la pestaña Design System.";
    case "credentials":
      return "El perfil MCP asignado no tiene URL (HTTP) o command (stdio) configurado. Complétalo en Ajustes → Componentes.";
    case "mapping-unconfirmed":
      return "El perfil MCP necesita un mapeo válido de catalog.list. En Ajustes → Componentes, pulsa Probar conexión y Confirma (p. ej. list_items_in_registries para shadcn, no fetch_ui_documentation / GitMCP).";
    default:
      return "";
  }
}
