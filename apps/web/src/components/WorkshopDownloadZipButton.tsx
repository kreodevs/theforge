import { Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";

const WORKSHOP_HEADER_ICON_BTN =
  "inline-flex items-center justify-center rounded-md h-8 w-8 p-0 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors";

interface DownloadZipButtonProps {
  onClick: () => void;
}

/** Botón "Descargar todos los documentos en ZIP" para la toolbar del Workshop. */
export function WorkshopDownloadZipButton({ onClick }: DownloadZipButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={WORKSHOP_HEADER_ICON_BTN}
          title="Descargar todos los documentos en ZIP"
          aria-label="Descargar todos los documentos del proyecto en ZIP"
        >
          <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Descargar ZIP del proyecto</TooltipContent>
    </Tooltip>
  );
}
