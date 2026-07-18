import { API_BASE, apiFetch } from "./apiClient.js";

export async function downloadProjectNotionExport(projectId: string, projectName: string): Promise<boolean> {
  const id = projectId.trim();
  if (!id) return false;
  const r = await apiFetch(`${API_BASE}/projects/${id}/export/notion?includeIntegration=true`);
  if (!r.ok) return false;
  const blob = await r.blob();
  const disposition = r.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename =
    match?.[1] ??
    `${(projectName || "proyecto").replace(/[^\w\u00C0-\u024F\-]/gi, "-").slice(0, 60)}-notion.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export interface NotionImportResult {
  project: { id: string; name: string };
  warnings: string[];
}

export interface NotionImportPairResult {
  newProject: { id: string; name: string };
  legacyProject: { id: string; name: string };
  warnings: string[];
}

export async function importProjectNotionZip(
  file: File,
  options?: { name?: string; groupId?: string; visibility?: "PRIVATE" | "SHARED" },
): Promise<NotionImportResult> {
  const form = new FormData();
  form.append("file", file);
  if (options?.name?.trim()) form.append("name", options.name.trim());
  if (options?.groupId) form.append("groupId", options.groupId);
  if (options?.visibility) form.append("visibility", options.visibility);

  const r = await apiFetch(`${API_BASE}/projects/import/notion`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(err?.message) ? err.message.join(", ") : err?.message;
    throw new Error(msg || "No se pudo importar el proyecto");
  }
  return (await r.json()) as NotionImportResult;
}

export async function importProjectNotionPair(params: {
  newZip: File;
  legacyZip: File;
  newProjectName?: string;
  legacyProjectName?: string;
  groupId?: string;
  visibility?: "PRIVATE" | "SHARED";
}): Promise<NotionImportPairResult> {
  const form = new FormData();
  form.append("newProject", params.newZip);
  form.append("legacyProject", params.legacyZip);
  if (params.newProjectName?.trim()) form.append("newProjectName", params.newProjectName.trim());
  if (params.legacyProjectName?.trim()) form.append("legacyProjectName", params.legacyProjectName.trim());
  if (params.groupId) form.append("groupId", params.groupId);
  if (params.visibility) form.append("visibility", params.visibility);

  const r = await apiFetch(`${API_BASE}/projects/import/notion/pair`, {
    method: "POST",
    body: form,
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => null)) as { message?: string | string[] } | null;
    const msg = Array.isArray(err?.message) ? err.message.join(", ") : err?.message;
    throw new Error(msg || "No se pudo importar la pareja NEW+LEGACY");
  }
  return (await r.json()) as NotionImportPairResult;
}
