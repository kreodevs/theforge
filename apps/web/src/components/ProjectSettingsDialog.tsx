/**
 * @fileoverview Configuración del proyecto: nombre (owner) y grupo (admin+).
 */
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
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

export interface ProjectGroupOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  currentName: string;
  currentGroupId: string | null;
  groups: ProjectGroupOption[];
  canEditName: boolean;
  canEditGroup: boolean;
  loading?: boolean;
  onSubmit: (projectId: string, data: { name?: string; groupId?: string }) => Promise<void>;
  onCreateGroup?: () => void;
  onExportNotion?: () => void;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectId,
  currentName,
  currentGroupId,
  groups,
  canEditName,
  canEditGroup,
  loading = false,
  onSubmit,
  onCreateGroup,
  onExportNotion,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState(currentName);
  const [groupId, setGroupId] = useState(currentGroupId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setGroupId(currentGroupId ?? "");
      setError(null);
    }
  }, [open, currentName, currentGroupId]);

  const handleSubmit = useCallback(async () => {
    if (!projectId) return;

    const trimmedName = name.trim();
    if (canEditName && !trimmedName) {
      setError("El nombre no puede estar vacío");
      return;
    }

    const payload: { name?: string; groupId?: string } = {};
    if (canEditName && trimmedName !== currentName.trim()) {
      payload.name = trimmedName;
    }
    if (canEditGroup && groupId && groupId !== currentGroupId) {
      payload.groupId = groupId;
    }

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    setError(null);
    try {
      await onSubmit(projectId, payload);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    }
  }, [
    name,
    groupId,
    projectId,
    currentName,
    currentGroupId,
    canEditName,
    canEditGroup,
    onSubmit,
    onOpenChange,
  ]);

  const showGroupField = canEditGroup || (currentGroupId && groups.length > 0);
  const currentGroupName = groups.find((g) => g.id === currentGroupId)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuración del proyecto</DialogTitle>
          <DialogDescription>
            El propietario puede cambiar el nombre. Los administradores pueden mover el proyecto entre grupos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <label htmlFor="project-settings-name" className="text-sm font-medium text-[var(--foreground)]">
              Nombre
            </label>
            <Input
              id="project-settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || !canEditName}
              readOnly={!canEditName}
              maxLength={120}
            />
            {!canEditName ? (
              <p className="text-xs text-[var(--foreground-muted)]">Solo el propietario puede editar el nombre.</p>
            ) : null}
          </div>

          {showGroupField ? (
            <div className="space-y-2">
              <span className="text-sm font-medium text-[var(--foreground)]">Grupo</span>
              {canEditGroup ? (
                <div className="flex items-stretch gap-2">
                  <div className="relative flex-1">
                    <select
                      id="project-settings-group"
                      className="h-9 w-full appearance-none rounded-md border border-[var(--border)] bg-[var(--card)] py-2 pl-3 pr-10 text-sm"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                      disabled={loading}
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                      aria-hidden
                    />
                  </div>
                  {onCreateGroup ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      onClick={onCreateGroup}
                      disabled={loading}
                      aria-label="Crear nuevo grupo"
                      title="Crear nuevo grupo"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-sm">
                  {currentGroupName ?? "—"}
                </p>
              )}
            </div>
          ) : null}

          {onExportNotion ? (
            <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3">
              <p className="text-sm font-medium text-[var(--foreground)]">Portabilidad (Notion)</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Export Markdown & CSV con handoff, etapas y documentos. Compatible con backup e import en otra instancia.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onExportNotion} disabled={loading}>
                Exportar proyecto
              </Button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
