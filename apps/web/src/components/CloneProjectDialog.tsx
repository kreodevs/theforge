/**
 * @fileoverview Modal to duplicate a project (`POST /projects/:id/clone`).
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

export interface CloneProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  sourceName: string;
  loading?: boolean;
  onSubmit: (projectId: string, name: string) => Promise<void>;
}

export function defaultCloneName(sourceName: string): string {
  const trimmed = sourceName.trim();
  const prefix = "Copia de ";
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) return trimmed;
  return `${prefix}${trimmed}`;
}

export function CloneProjectDialog({
  open,
  onOpenChange,
  projectId,
  sourceName,
  loading = false,
  onSubmit,
}: CloneProjectDialogProps) {
  const [name, setName] = useState(defaultCloneName(sourceName));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultCloneName(sourceName));
      setError(null);
    }
  }, [open, sourceName]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío");
      return;
    }
    if (!projectId) return;
    setError(null);
    try {
      await onSubmit(projectId, trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo clonar");
    }
  }, [name, projectId, onSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clonar proyecto</DialogTitle>
          <DialogDescription>
            Crea una copia independiente con los mismos documentos y etapas. No se copian chats,
            favoritos ni enlaces de integración.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <label htmlFor="clone-project-name" className="text-sm font-medium text-[var(--foreground)]">
            Nombre del nuevo proyecto
          </label>
          <Input
            id="clone-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={loading || !projectId}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Clonar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
