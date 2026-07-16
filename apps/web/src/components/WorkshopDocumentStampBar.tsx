import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkshopDocumentTimestamps } from "@/utils/workshop-document-content.util";

type WorkshopDocumentStampBarProps = {
  timestamps: WorkshopDocumentTimestamps | null | undefined;
  className?: string;
};

/**
 * Cabecera visible de trazabilidad (Creado / Última regeneración).
 * El stamp vive en el markdown persistido; el editor y MddViewer lo quitan del cuerpo visible.
 */
export function WorkshopDocumentStampBar({
  timestamps,
  className,
}: WorkshopDocumentStampBarProps) {
  if (!timestamps) return null;

  const regenerated = timestamps.created !== timestamps.updated;

  return (
    <div
      className={cn(
        "mb-3 flex shrink-0 flex-wrap items-start gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] px-3 py-2.5 text-xs leading-relaxed text-[var(--foreground)]",
        className,
      )}
      role="status"
      aria-label="Fechas del documento"
    >
      <CalendarClock
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]"
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          <span className="font-medium text-[var(--muted-foreground)]">Creado:</span>{" "}
          {timestamps.created}
        </p>
        <p>
          <span className="font-medium text-[var(--muted-foreground)]">Última regeneración:</span>{" "}
          {timestamps.updated}
        </p>
        {!regenerated ? (
          <p className="text-[var(--muted-foreground)]">
            Sin regeneraciones posteriores a la creación. Si editaste el MDD o pediste regenerar
            entregables, comprueba que la fecha de regeneración coincida con tu último cambio.
          </p>
        ) : null}
      </div>
    </div>
  );
}
