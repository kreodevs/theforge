/**
 * @fileoverview Modal para crear un grupo de proyectos (`POST /project-groups`).
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

export interface CreateProjectGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onSubmit: (name: string) => Promise<void>;
}

export function CreateProjectGroupDialog({
  open,
  onOpenChange,
  loading = false,
  onSubmit,
}: CreateProjectGroupDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre no puede estar vacío");
      return;
    }
    setError(null);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el grupo");
    }
  }, [name, onSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo grupo</DialogTitle>
          <DialogDescription>
            Los proyectos nuevos se asignan al grupo por defecto hasta que un admin los mueva.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <label htmlFor="create-project-group-name" className="text-sm font-medium text-[var(--foreground)]">
            Nombre del grupo
          </label>
          <Input
            id="create-project-group-name"
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
                Creando…
              </>
            ) : (
              "Crear grupo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
