import { Loader2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";

interface WorkshopRegenButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel: string;
  tooltip?: string;
}

/** Botón de recarga/regeneración para la toolbar de documentos del Workshop. */
export function WorkshopRegenButton({
  onClick,
  disabled = false,
  loading = false,
  ariaLabel,
  tooltip,
}: WorkshopRegenButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-md h-8 w-8 p-0 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40 transition-colors"
          aria-label={ariaLabel}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--primary)]" strokeWidth={2} aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4 shrink-0 text-[var(--primary)]" strokeWidth={2} aria-hidden />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-[16rem]">
        {tooltip ?? ariaLabel}
      </TooltipContent>
    </Tooltip>
  );
}
