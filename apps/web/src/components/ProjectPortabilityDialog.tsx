/**
 * @fileoverview Export/import de proyecto en ZIP Markdown & CSV (convención Notion).
 */
import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@/components/ui";
import {
  downloadProjectNotionExport,
  importProjectNotionPair,
  importProjectNotionZip,
} from "../utils/projectNotionPortability.js";

export type ProjectPortabilityMode = "export" | "import" | "import-pair";

export interface ProjectPortabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ProjectPortabilityMode;
  projectId?: string | null;
  projectName?: string;
  onImported?: (projectId: string, projectName: string) => void;
  onPairImported?: (newId: string, legacyId: string) => void;
}

export function ProjectPortabilityDialog({
  open,
  onOpenChange,
  mode,
  projectId,
  projectName = "",
  onImported,
  onPairImported,
}: ProjectPortabilityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importName, setImportName] = useState("");
  const [newName, setNewName] = useState("");
  const [legacyName, setLegacyName] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [legacyFile, setLegacyFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setWarnings([]);
      setImportName("");
      setNewName("");
      setLegacyName("");
      setSingleFile(null);
      setNewFile(null);
      setLegacyFile(null);
    }
  }, [open, mode]);

  const handleExport = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await downloadProjectNotionExport(projectId, projectName);
      if (!ok) throw new Error("No se pudo exportar el proyecto");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setLoading(false);
    }
  }, [projectId, projectName, onOpenChange]);

  const handleImport = useCallback(async () => {
    if (!singleFile) {
      setError("Selecciona un archivo ZIP");
      return;
    }
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const result = await importProjectNotionZip(singleFile, {
        name: importName.trim() || undefined,
      });
      setWarnings(result.warnings ?? []);
      onImported?.(result.project.id, result.project.name);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setLoading(false);
    }
  }, [singleFile, importName, onImported, onOpenChange]);

  const handleImportPair = useCallback(async () => {
    if (!newFile || !legacyFile) {
      setError("Sube el ZIP NEW y el ZIP LEGACY");
      return;
    }
    setLoading(true);
    setError(null);
    setWarnings([]);
    try {
      const result = await importProjectNotionPair({
        newZip: newFile,
        legacyZip: legacyFile,
        newProjectName: newName.trim() || undefined,
        legacyProjectName: legacyName.trim() || undefined,
      });
      setWarnings(result.warnings ?? []);
      onPairImported?.(result.newProject.id, result.legacyProject.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar pareja");
    } finally {
      setLoading(false);
    }
  }, [newFile, legacyFile, newName, legacyName, onPairImported, onOpenChange]);

  const title =
    mode === "export"
      ? "Exportar proyecto (Markdown & CSV)"
      : mode === "import-pair"
        ? "Importar pareja NEW + LEGACY"
        : "Importar proyecto";

  const description =
    mode === "export"
      ? "Descarga un ZIP compatible con Notion: páginas .md, CSV de integración y carpetas por etapa. Incluye _theforge/manifest.json para reimportar en The Forge."
      : mode === "import-pair"
        ? "Restaura el vínculo de integración subiendo los dos exports (proyecto NEW y LEGACY) generados desde The Forge."
        : "Sube un ZIP exportado desde The Forge (Markdown & CSV). Para handoff enlazado usa importación en pareja.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {mode === "export" ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Proyecto: <strong className="text-[var(--foreground)]">{projectName || "—"}</strong>
            </p>
          ) : null}

          {mode === "import" ? (
            <>
              <div className="space-y-2">
                <label htmlFor="notion-import-file" className="text-sm font-medium">
                  Archivo ZIP
                </label>
                <Input
                  id="notion-import-file"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={loading}
                  onChange={(e) => setSingleFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="notion-import-name" className="text-sm font-medium">
                  Nombre (opcional)
                </label>
                <Input
                  id="notion-import-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  disabled={loading}
                  placeholder="Usar nombre del export"
                />
              </div>
            </>
          ) : null}

          {mode === "import-pair" ? (
            <>
              <div className="space-y-2">
                <label htmlFor="notion-new-zip" className="text-sm font-medium">
                  ZIP proyecto NEW
                </label>
                <Input
                  id="notion-new-zip"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={loading}
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="notion-legacy-zip" className="text-sm font-medium">
                  ZIP proyecto LEGACY
                </label>
                <Input
                  id="notion-legacy-zip"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={loading}
                  onChange={(e) => setLegacyFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="notion-new-name" className="text-sm font-medium">
                    Nombre NEW (opc.)
                  </label>
                  <Input
                    id="notion-new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="notion-legacy-name" className="text-sm font-medium">
                    Nombre LEGACY (opc.)
                  </label>
                  <Input
                    id="notion-legacy-name"
                    value={legacyName}
                    onChange={(e) => setLegacyName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          ) : null}

          {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
          {warnings.length > 0 ? (
            <ul className="list-inside list-disc rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-xs text-[var(--muted-foreground)]">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {mode === "export" ? (
            <Button type="button" onClick={() => void handleExport()} disabled={loading || !projectId}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
              Exportar ZIP
            </Button>
          ) : mode === "import-pair" ? (
            <Button type="button" onClick={() => void handleImportPair()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-2 h-4 w-4" aria-hidden />}
              Importar pareja
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleImport()} disabled={loading || !singleFile}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-2 h-4 w-4" aria-hidden />}
              Importar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
