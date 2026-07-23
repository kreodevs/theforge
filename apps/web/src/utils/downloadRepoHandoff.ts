import {
  buildSpecKitBundleFiles,
  type AgentGovernanceScaffold,
  type SpecKitBundleFile,
  type SpecKitBundleInput,
} from "@theforge/shared-types";
import { apiFetch, API_BASE } from "./apiClient.js";
import { loadJsZip } from "./loadJsZip.js";
import { readApiErrorMessage } from "./readApiErrorMessage.js";
import { triggerBrowserBlobDownload } from "./triggerBrowserBlobDownload.js";
import { downloadAgentGovernanceZip } from "./downloadAgentGovernanceZip.js";
import { downloadDocumentsZip, type DocumentsForZip } from "./downloadDocumentsZip.js";
import { addSpecKitBundleToZip } from "./downloadSpecKitBundle.js";
import {
  addAgentGovernanceEntriesToZip,
  buildAgentGovernanceZipEntries,
  buildUnifiedHandoffManifest,
  AGENT_GOVERNANCE_ZIP_ROOT,
  normalizeAgentGovernanceZipPath,
} from "./downloadAgentGovernanceZip.js";

export type WorkshopProjectZipKind = "repo-handoff" | "governance-fallback" | "documents" | "none";

export interface DownloadWorkshopProjectZipResult {
  ok: boolean;
  kind: WorkshopProjectZipKind;
  error?: string;
}

export interface DownloadWorkshopProjectZipOptions {
  projectId: string | null | undefined;
  projectName: string;
  hasAgentGovernance: boolean;
  documents: DocumentsForZip;
  governanceScaffold?: AgentGovernanceScaffold | null;
  specKitInput?: SpecKitBundleInput | null;
  fetchGovernanceExport?: (projectId: string) => Promise<AgentGovernanceScaffold | null>;
}

export interface RepoHandoffApiResponse {
  featureDir: string;
  projectName: string;
  specKitFiles: SpecKitBundleFile[];
  agentGovernance: {
    present: boolean;
    files: Array<{ path: string; content: string }>;
    manifest?: Record<string, unknown>;
  };
}

/** Descarga ZIP handoff completo (spec-kit + gobernanza aplanada en raíz del ZIP). */
export async function downloadRepoHandoffFromApi(
  projectId: string,
  projectName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/export/repo-handoff`);
  if (!r.ok) {
    return {
      ok: false,
      error: await readApiErrorMessage(r, "No se pudo exportar el ZIP handoff desde el servidor."),
    };
  }
  let data: RepoHandoffApiResponse;
  try {
    data = (await r.json()) as RepoHandoffApiResponse;
  } catch {
    return { ok: false, error: "Respuesta inválida del servidor al exportar handoff." };
  }
  if (!data.specKitFiles?.length) {
    return { ok: false, error: "El servidor no devolvió archivos spec-kit para el handoff." };
  }

  const JSZip = await loadJsZip();
  const zip = new JSZip();
  addSpecKitBundleToZip(zip, data.specKitFiles);

  if (data.agentGovernance.present && data.agentGovernance.files.length > 0) {
    const manifestFiles = data.agentGovernance.files
      .map((f) => normalizeAgentGovernanceZipPath(f.path))
      .filter((p) => p && p !== "MANIFEST.json");
    const scaffold: AgentGovernanceScaffold = {
      manifest: {
        templateVersion: "2.0.0",
        files: manifestFiles,
        ...(data.agentGovernance.manifest ?? {}),
      },
      files: data.agentGovernance.files.map((f) => ({
        path: f.path,
        content: f.content,
      })),
    };
    const build = buildAgentGovernanceZipEntries(scaffold);
    if (build) {
      const handoffBuild = {
        ...build,
        manifest: {
          ...build.manifest,
          files: buildUnifiedHandoffManifest(build.manifest.files, data.specKitFiles),
        },
      };
      addAgentGovernanceEntriesToZip(zip, handoffBuild, { flattenToZipRoot: true });
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = (projectName || "workshop").replace(/[^\w\u00C0-\u024F\-]/gi, "-").slice(0, 80);
  const zipName = `${safeName}-repo-handoff.zip`;
  triggerBrowserBlobDownload(blob, zipName);
  return { ok: true };
}

/**
 * Descarga del header Workshop: handoff completo (spec-kit + gobernanza + docs/sdd) cuando
 * hay gobernanza; si falla el API, fallback client-side; sin gobernanza, solo documentos planos.
 */
export async function downloadWorkshopProjectZip(
  options: DownloadWorkshopProjectZipOptions,
): Promise<DownloadWorkshopProjectZipResult> {
  const pid = options.projectId?.trim();
  const name = options.projectName || "Workshop";

  if (pid && options.hasAgentGovernance) {
    const apiResult = await downloadRepoHandoffFromApi(pid, name);
    if (apiResult.ok) {
      return { ok: true, kind: "repo-handoff" };
    }

    if (options.specKitInput) {
      let scaffold = options.governanceScaffold ?? null;
      if (options.fetchGovernanceExport) {
        scaffold = (await options.fetchGovernanceExport(pid)) ?? scaffold;
      }
      if (scaffold) {
        const consumptionGuideContent =
          scaffold.files.find((f) => f.path.endsWith("THEFORGE-DOC-CONSUMPTION-GUIDE.md"))
            ?.content ?? null;
        const zipOk = await downloadAgentGovernanceZip(
          scaffold,
          name,
          buildSpecKitBundleFiles({
            ...options.specKitInput,
            consumptionGuideContent:
              options.specKitInput.consumptionGuideContent ?? consumptionGuideContent,
          }),
        );
        if (zipOk) return { ok: true, kind: "governance-fallback" };
      }
    }

    return { ok: false, kind: "none", error: apiResult.error };
  }

  const docsOk = await downloadDocumentsZip(options.documents, name);
  return {
    ok: docsOk,
    kind: docsOk ? "documents" : "none",
    error: docsOk ? undefined : "No hay documentos con contenido para descargar.",
  };
}

export { AGENT_GOVERNANCE_ZIP_ROOT };
