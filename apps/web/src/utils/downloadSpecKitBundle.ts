import type JSZip from "jszip";
import {
  buildSpecKitBundleFiles,
  type SpecKitBundleFile,
  type SpecKitBundleInput,
} from "@theforge/shared-types";
import { apiFetch, API_BASE } from "./apiClient.js";
import { loadJsZip } from "./loadJsZip.js";
import { readApiErrorMessage } from "./readApiErrorMessage.js";
import { triggerBrowserBlobDownload } from "./triggerBrowserBlobDownload.js";

export type { SpecKitBundleInput };

/** Añade archivos del bundle spec-kit en la raíz del ZIP (rutas `.specify/`, `specs/`, etc.). */
export function addSpecKitBundleToZip(zip: JSZip, files: SpecKitBundleFile[]): void {
  for (const file of files) {
    zip.file(file.path, file.content, { createFolders: true });
  }
}

/**
 * Genera y descarga un ZIP con layout compatible con github/spec-kit.
 * @returns true si el ZIP contiene al menos un archivo
 */
export async function downloadSpecKitBundle(
  input: SpecKitBundleInput,
  projectName: string,
): Promise<boolean> {
  const files = buildSpecKitBundleFiles(input);
  if (files.length === 0) return false;

  const JSZip = await loadJsZip();
  const zip = new JSZip();
  addSpecKitBundleToZip(zip, files);

  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = (projectName || "workshop").replace(/[^\w\u00C0-\u024F\-]/gi, "-").slice(0, 80);
  const zipName = `${safeName}-sdd-spec-kit.zip`;
  triggerBrowserBlobDownload(blob, zipName);
  return true;
}

/** Descarga bundle desde API (incluye THEFORGE-DOC-CONSUMPTION-GUIDE del servidor). */
export async function downloadSpecKitBundleFromApi(
  projectId: string,
  projectName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiFetch(`${API_BASE}/projects/${projectId.trim()}/export/sdd-bundle`);
  if (!r.ok) {
    return {
      ok: false,
      error: await readApiErrorMessage(r, "No se pudo exportar el bundle SDD desde el servidor."),
    };
  }
  let data: { files?: SpecKitBundleFile[] };
  try {
    data = (await r.json()) as { files: SpecKitBundleFile[] };
  } catch {
    return { ok: false, error: "Respuesta inválida del servidor al exportar SDD." };
  }
  if (!data.files?.length) {
    return { ok: false, error: "No hay contenido MDD para exportar bundle SDD." };
  }

  const JSZip = await loadJsZip();
  const zip = new JSZip();
  addSpecKitBundleToZip(zip, data.files);
  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = (projectName || "workshop").replace(/[^\w\u00C0-\u024F\-]/gi, "-").slice(0, 80);
  const zipName = `${safeName}-sdd-spec-kit.zip`;
  triggerBrowserBlobDownload(blob, zipName);
  return { ok: true };
}
