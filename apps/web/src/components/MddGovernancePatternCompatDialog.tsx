import type { GovernancePatternCorrection } from "@theforge/shared-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/AlertDialog";

export interface MddGovernancePatternCompatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corrections: readonly GovernancePatternCorrection[];
  /** p. ej. «Continuar y generar MDD» o «Guardar patrones» */
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function MddGovernancePatternCompatDialog({
  open,
  onOpenChange,
  corrections,
  confirmLabel,
  loading = false,
  onConfirm,
}: MddGovernancePatternCompatDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Patrones incompatibles corregidos</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Detectamos combinaciones que no pueden aplicarse a la vez. Ajustamos la selección
                automáticamente:
              </p>
              <ul className="list-disc space-y-2 pl-5 text-foreground/90">
                {corrections.map((c) => (
                  <li key={`${c.removedId}-${c.keptId}`}>
                    Se desmarcó <strong>{c.removedLabel}</strong> (se mantiene{" "}
                    <strong>{c.keptLabel}</strong>): {c.reason}
                  </li>
                ))}
              </ul>
              <p>¿Deseas continuar con la selección corregida?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
