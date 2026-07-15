import type JSZip from "jszip";
import type {
  AgentGovernanceManifest,
  AgentGovernanceScaffold,
} from "@theforge/shared-types";
import type { SpecKitBundleFile } from "@theforge/shared-types";
import {
  buildGovernanceInstallMap,
  buildMultiTargetInstallMaps,
  GOVERNANCE_DOCS_PREFIX,
  migrateGovernancePath,
} from "@theforge/shared-types";
import { loadJsZip } from "./loadJsZip.js";

export const AGENT_GOVERNANCE_ZIP_ROOT = "agent-governance";

/** Prefijo visible en ZIP (paridad con `@theforge/shared-types`). */
export { GOVERNANCE_DOCS_PREFIX };

/** Normaliza rutas del scaffold al layout visible del ZIP (sin `.cursor/`). */
export function normalizeAgentGovernanceZipPath(path: string): string {
  return migrateGovernancePath(path);
}

/** Fusiona rutas de gobernanza y spec-kit en `manifest.files` (implement/repo handoff). */
export function buildUnifiedHandoffManifest(
  governancePaths: string[],
  specKitFiles?: SpecKitBundleFile[],
): string[] {
  const specKitPaths = (specKitFiles ?? [])
    .map((f) => f.path.trim())
    .filter((p) => p && p !== "MANIFEST.json");
  return [...new Set([...governancePaths, ...specKitPaths])].sort((a, b) =>
    a.localeCompare(b),
  );
}

function defaultMcpJsonPlaceholder(): string {
  return JSON.stringify(
    {
      mcpServers: {
        theforge: {
          url: "{{API_URL}}/mcp",
          headers: {
            Authorization: "Bearer {{MCP_M2M_SECRET}}",
          },
        },
      },
    },
    null,
    2,
  );
}

/** MEDIUM/HIGH: references o rules/skills bajo `docs/agent-governance/`. */
function shouldIncludeMcpPlaceholder(files: AgentGovernanceScaffold["files"]): boolean {
  return files.some((file) => {
    const path = normalizeAgentGovernanceZipPath(file.path);
    return (
      path.startsWith(`${GOVERNANCE_DOCS_PREFIX}references/`) ||
      path.startsWith(`${GOVERNANCE_DOCS_PREFIX}rules/`) ||
      path.startsWith(`${GOVERNANCE_DOCS_PREFIX}skills/`)
    );
  });
}

/** Añade archivos spec-kit en la raíz del ZIP (evita importar downloadSpecKitBundle en tests). */
function addSpecKitBundleToZip(zip: JSZip, files: SpecKitBundleFile[]): void {
  for (const file of files) {
    zip.file(file.path, file.content, { createFolders: true });
  }
}

export interface AgentGovernanceZipBuildResult {
  entries: Map<string, string>;
  manifest: AgentGovernanceManifest;
}

/**
 * Construye entradas del ZIP desde `scaffold.files`.
 * Reescribe rutas legacy `.cursor/` → `docs/agent-governance/`; el ZIP no contiene `.cursor/`.
 */
export function buildAgentGovernanceZipEntries(
  scaffold: AgentGovernanceScaffold,
): AgentGovernanceZipBuildResult | null {
  if (!scaffold.files.length) return null;

  const entries = new Map<string, string>();

  for (const file of scaffold.files) {
    const path = normalizeAgentGovernanceZipPath(file.path);
    if (!path || path === "MANIFEST.json") continue;
    if (path.startsWith(".cursor/")) continue;
    entries.set(path, file.content);
  }

  const mcpExample = `${GOVERNANCE_DOCS_PREFIX}mcp.json.example`;
  if (shouldIncludeMcpPlaceholder(scaffold.files) && !entries.has(mcpExample)) {
    entries.set(mcpExample, defaultMcpJsonPlaceholder());
  }

  const paths = [...entries.keys()].sort((a, b) => a.localeCompare(b));
  const manifest: AgentGovernanceManifest = {
    ...scaffold.manifest,
    templateVersion: scaffold.manifest.templateVersion,
    files: paths,
    installMap: scaffold.manifest.installMap ?? buildGovernanceInstallMap(paths, "cursor"),
    installMaps: scaffold.manifest.installMaps ?? buildMultiTargetInstallMaps(paths),
    prompts: scaffold.manifest.prompts,
  };

  return { entries, manifest };
}

export interface AgentGovernanceZipOptions {
  /** Repo-handoff: escribe entradas en la raíz del ZIP (sin prefijo `agent-governance/`). */
  flattenToZipRoot?: boolean;
}

/** Añade entradas al ZIP; por defecto bajo `agent-governance/`, o en raíz si `flattenToZipRoot`. */
export function addAgentGovernanceEntriesToZip(
  zip: JSZip,
  build: AgentGovernanceZipBuildResult,
  options?: AgentGovernanceZipOptions,
): void {
  const prefix = options?.flattenToZipRoot ? "" : `${AGENT_GOVERNANCE_ZIP_ROOT}/`;
  for (const [path, content] of build.entries) {
    zip.file(`${prefix}${path}`, content, { createFolders: true });
  }
  zip.file(
    `${prefix}MANIFEST.json`,
    JSON.stringify(build.manifest, null, 2),
    { createFolders: false },
  );
}

/**
 * Empaqueta el scaffold y dispara la descarga en el navegador.
 * Todo el contenido de gobernanza va bajo `docs/agent-governance/` (visible).
 */
export function logAgentGovernanceZipBuild(
  build: AgentGovernanceZipBuildResult,
  source: "scaffold" | "export" = "scaffold",
): void {
  const paths = [...build.entries.keys()];
  const governancePaths = paths.filter((p) => p.startsWith(GOVERNANCE_DOCS_PREFIX));
  const installTargets = paths.filter((p) => p.startsWith("install-targets/"));
  const cursorLeak = paths.filter((p) => p.startsWith(".cursor/"));
  const promptFiles = paths.filter((p) => p.startsWith("PROMPT-INICIAL"));
  const payload = {
    source,
    totalEntries: build.entries.size,
    governanceEntries: governancePaths.length,
    installTargetEntries: installTargets.length,
    promptFileCount: promptFiles.length,
    cursorLeakCount: cursorLeak.length,
    governancePaths,
    installTargetPaths: installTargets,
    promptPaths: promptFiles,
    allPaths: paths.sort((a, b) => a.localeCompare(b)),
    manifestFiles: build.manifest.files.length,
    installMapCount: build.manifest.installMap?.length ?? 0,
    installMapsTargets: Object.keys(build.manifest.installMaps ?? {}),
  };
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.info("[agent-governance-zip]", payload);
  }
}

export async function downloadAgentGovernanceZip(
  scaffold: AgentGovernanceScaffold,
  projectName: string,
  specKitBundle?: SpecKitBundleFile[],
  zipOptions?: AgentGovernanceZipOptions,
): Promise<boolean> {
  const build = buildAgentGovernanceZipEntries(scaffold);
  if (!build || build.entries.size === 0) return false;

  logAgentGovernanceZipBuild(build, "export");

  const JSZip = await loadJsZip();
  const zip = new JSZip();
  const handoffBuild =
    specKitBundle?.length
      ? {
          ...build,
          manifest: {
            ...build.manifest,
            files: buildUnifiedHandoffManifest(build.manifest.files, specKitBundle),
          },
        }
      : build;
  addAgentGovernanceEntriesToZip(zip, handoffBuild, { flattenToZipRoot: true, ...zipOptions });
  if (specKitBundle?.length) {
    addSpecKitBundleToZip(zip, specKitBundle);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = (projectName || "workshop").replace(/[^\w\u00C0-\u024F\-]/gi, "-").slice(0, 80);
  const suffix = specKitBundle?.length ? "-implement-handoff" : "-agent-governance";
  const zipName = `${safeName}${suffix}.zip`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = zipName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}
