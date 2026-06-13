/**
 * @fileoverview Modal para renombrar un proyecto (`PATCH /projects/:id` con `{ name }`).
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

export interface RenameProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  currentName: string;
  loading?: boolean;
  onSubmit: (projectId: string, name: string) => Promise<void>;
}

export function RenameProjectDialog({
  open,
  onOpenChange,
  projectId,
  currentName,
  loading = false,
  onSubmit,
}: RenameProjectDialogProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío");
      return;
    }
    if (!projectId) return;
    if (trimmed === currentName.trim()) {
      onOpenChange(false);
      return;
    }
    setError(null);
    try {
      await onSubmit(projectId, trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar");
    }
  }, [name, projectId, currentName, onSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renombrar proyecto</DialogTitle>
          <DialogDescription>
            Solo el propietario puede cambiar el nombre. Se actualiza en el dashboard y en el Workshop.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <label htmlFor="rename-project-name" className="text-sm font-medium text-[var(--foreground)]">
            Nombre
          </label>
          <Input
            id="rename-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={loading}
            autoFocus
            maxLength={120}
          />
          {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={loading || !name.trim()}>
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
