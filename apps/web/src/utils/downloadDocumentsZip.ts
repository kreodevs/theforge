import { exportPantallasMarkdownOnly, splitPantallasAndUiProject } from "@theforge/shared-types";
import { loadJsZip } from "./loadJsZip.js";

export interface DocumentsForZip {
  dbgaContent: string | null;
  phase0SummaryContent: string | null;
  specContent: string | null;
  mddContent: string;
  uxUiGuideContent: string | null;
  uiScreensContent?: string | null;
  blueprintContent: string | null;
  apiContractsContent: string | null;
  logicFlowsContent: string | null;
  tasksContent: string | null;
  infraContent: string | null;
  aemContent: string | null;
}

/**
 * Genera un ZIP con todos los documentos que tengan contenido y dispara la descarga.
 * @param documents Contenidos actuales (store o project)
 * @param projectName Nombre del proyecto para el archivo .zip
 * @returns true si se descargó al menos un documento, false si no había contenido
 */
export async function downloadDocumentsZip(
  documents: DocumentsForZip,
  projectName: string,
): Promise<boolean> {
  const JSZip = await loadJsZip();
  const zip = new JSZip();

  const entries: [string, string][] = [
    ["benchmark.md", documents.dbgaContent ?? ""],
    ["phase0-deep-research.md", documents.phase0SummaryContent ?? ""],
    ["spec.md", documents.specContent ?? ""],
    ["mdd.md", documents.mddContent ?? ""],
    ["design-system.md", documents.uxUiGuideContent ?? ""],
    ["pantallas.md", documents.uiScreensContent ?? ""],
    ["blueprint.md", documents.blueprintContent ?? ""],
    ["api-contracts.md", documents.apiContractsContent ?? ""],
    ["logic-flows.md", documents.logicFlowsContent ?? ""],
    ["tasks.md", documents.tasksContent ?? ""],
    ["infra.md", documents.infraContent ?? ""],
    ["aem.md", documents.aemContent ?? ""],
  ];

  let count = 0;
  for (const [filename, content] of entries) {
    let trimmed = (content ?? "").trim();
    if (filename === "pantallas.md" && trimmed.length > 0) {
      trimmed = exportPantallasMarkdownOnly(trimmed);
      const { uiProjectJson } = splitPantallasAndUiProject(content ?? "");
      if (uiProjectJson?.trim()) {
        zip.file("ui-project.json", uiProjectJson.trim(), { createFolders: false });
        count += 1;
      }
    }
    if (trimmed.length > 0) {
      zip.file(filename, trimmed, { createFolders: false });
      count += 1;
    }
  }

  if (count === 0) return false;

  const blob = await zip.generateAsync({ type: "blob" });
  const safeName = (projectName || "workshop").replace(/[^\w\u00C0-\u024F\-]/gi, "-").slice(0, 80);
  const zipName = `${safeName}-documentos.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
