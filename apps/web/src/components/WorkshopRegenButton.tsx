import { Loader2, RefreshCw, Square } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui";
import { WorkshopDocToolbarIcon, WorkshopDocToolbarIconButton } from "@/components/WorkshopButtons";
import { WORKSHOP_DOC_TOOLBAR_ICON } from "@/constants/workshopDocToolbar";
import { cn } from "@/lib/utils";

interface WorkshopRegenButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel: string;
  tooltip?: string;
  /** When provided and `loading` is true, hover swaps spinner for a stop icon. */
  onCancel?: () => void;
  cancelTooltip?: string;
}

/** Regenerate action for the workshop document toolbar (same chrome as preview / print). */
export function WorkshopRegenButton({
  onClick,
  disabled = false,
  loading = false,
  ariaLabel,
  tooltip,
  onCancel,
  cancelTooltip,
}: WorkshopRegenButtonProps) {
  if (loading && onCancel) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <WorkshopDocToolbarIconButton
              onClick={onCancel}
              aria-label={cancelTooltip ?? "Detener"}
              className="group/stop"
            >
              <Loader2
                className={cn(WORKSHOP_DOC_TOOLBAR_ICON, "animate-spin group-hover/stop:hidden")}
                strokeWidth={2}
                aria-hidden
              />
              <Square
                className={cn(WORKSHOP_DOC_TOOLBAR_ICON, "hidden fill-current text-red-500 group-hover/stop:block dark:text-red-400")}
                strokeWidth={2}
                aria-hidden
              />
            </WorkshopDocToolbarIconButton>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-[16rem]">
            {cancelTooltip ?? "Detener"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <WorkshopDocToolbarIconButton
          onClick={onClick}
          disabled={disabled || loading}
          aria-label={ariaLabel}
        >
          {loading ? (
            <Loader2 className={cn(WORKSHOP_DOC_TOOLBAR_ICON, "animate-spin")} strokeWidth={2} aria-hidden />
          ) : (
            <WorkshopDocToolbarIcon icon={RefreshCw} />
          )}
        </WorkshopDocToolbarIconButton>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-[16rem]">
        {tooltip ?? ariaLabel}
      </TooltipContent>
    </Tooltip>
  );
}
