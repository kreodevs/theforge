import { api } from "@/lib/api";
import { parseErrorMessageFromResponse } from "@/utils/httpError";
import type {
  ComponentSourceProfileSummary,
  ComponentSourceProfileTestResult,
  ComponentSourceProposedToolMapping,
  ProjectComponentSourceProfileAssignment,
  UpsertComponentSourceProfileBody,
} from "@/types/component-source-profiles";

/** CRUD + test + confirm-mapping — backend: ComponentSourceAuthController */
const PROFILES_BASE = "/api/auth/component-source/profiles";
/** Project owner assignment — backend: ComponentSourceController */
const PROJECTS_BASE = "/api/component-source/projects";

async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (!res.ok) {
    throw new Error(await parseErrorMessageFromResponse(res, fallback));
  }
}

export async function fetchComponentSourceProfiles(): Promise<ComponentSourceProfileSummary[]> {
  const res = await api.get(PROFILES_BASE);
  await ensureOk(res, "No se pudieron cargar los perfiles MCP");
  const data = (await res.json()) as ComponentSourceProfileSummary[] | { profiles?: ComponentSourceProfileSummary[] };
  if (Array.isArray(data)) return data;
  return data.profiles ?? [];
}

export async function createComponentSourceProfile(
  body: UpsertComponentSourceProfileBody,
): Promise<ComponentSourceProfileSummary> {
  const res = await api.post(PROFILES_BASE, { ...body, pluginId: body.pluginId ?? "mcp" });
  await ensureOk(res, "No se pudo crear el perfil MCP");
  return res.json() as Promise<ComponentSourceProfileSummary>;
}

export async function updateComponentSourceProfile(
  id: string,
  body: Partial<UpsertComponentSourceProfileBody>,
): Promise<ComponentSourceProfileSummary> {
  const res = await api.patch(`${PROFILES_BASE}/${id}`, body);
  await ensureOk(res, "No se pudo actualizar el perfil MCP");
  return res.json() as Promise<ComponentSourceProfileSummary>;
}

export async function deleteComponentSourceProfile(id: string): Promise<void> {
  const res = await api.delete(`${PROFILES_BASE}/${id}`);
  await ensureOk(res, "No se pudo eliminar el perfil MCP");
}

export async function testComponentSourceProfile(
  id: string,
  body?: { url?: string; token?: string; useSaved?: boolean },
): Promise<ComponentSourceProfileTestResult> {
  const res = await api.post(`${PROFILES_BASE}/${id}/test`, body ?? { useSaved: true });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    message?: string;
    service?: string;
    mode?: "health" | "mapping";
    proposedMapping?: ComponentSourceProposedToolMapping;
    capabilities?: ComponentSourceProfileSummary["capabilities"];
    toolsListHash?: string;
  };

  if (!res.ok) {
    return { ok: false, error: data.error ?? data.message ?? "Conexión fallida" };
  }

  if (data.mode === "mapping" && data.proposedMapping) {
    return {
      ok: true,
      mode: "mapping",
      proposedMapping: data.proposedMapping,
      capabilities: data.capabilities ?? undefined,
      toolsListHash: data.toolsListHash,
    };
  }

  if (data.ok === false) {
    return { ok: false, error: data.error ?? "Conexión fallida" };
  }

  return { ok: true, mode: "health", service: data.service };
}

export async function confirmComponentSourceProfileMapping(
  id: string,
  body?: { toolMapping?: ComponentSourceProposedToolMapping },
): Promise<ComponentSourceProfileSummary> {
  const res = await api.post(`${PROFILES_BASE}/${id}/confirm-mapping`, body ?? {});
  await ensureOk(res, "No se pudo confirmar el mapeo MCP");
  return res.json() as Promise<ComponentSourceProfileSummary>;
}

export async function setProjectComponentSourceProfile(
  projectId: string,
  profileId: string | null,
): Promise<ProjectComponentSourceProfileAssignment> {
  const res = await api.put(`${PROJECTS_BASE}/${projectId}/profile`, { profileId });
  await ensureOk(res, "No se pudo actualizar el perfil MCP del proyecto");
  return res.json() as Promise<ProjectComponentSourceProfileAssignment>;
}

/** Fetches full design system markdown from the project's assigned MCP profile. */
export async function fetchProjectDesignSystemFromMcp(
  projectId: string,
): Promise<{ designMd: string; tokens?: unknown; meta?: unknown }> {
  const res = await api.post(`/api/auth/component-source/projects/${projectId}/design-system`);
  await ensureOk(res, "No se pudo importar el design system desde MCP");
  return res.json() as Promise<{ designMd: string; tokens?: unknown; meta?: unknown }>;
}

/** Returns a user-facing message when delete is blocked because projects reference the profile. */
export function formatProfileInUseError(message: string): string {
  if (/in use|en uso|referenc|project/i.test(message)) {
    return `${message} Desvincula el perfil en los proyectos del taller antes de eliminarlo.`;
  }
  return message;
}
