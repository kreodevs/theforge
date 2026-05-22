import { Loader2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { WorkshopDocToolbarIcon, WorkshopDocToolbarIconButton } from "@/components/WorkshopButtons";
import { WORKSHOP_DOC_TOOLBAR_ICON } from "@/constants/workshopDocToolbar";
import { cn } from "@/lib/utils";

interface WorkshopRegenButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel: string;
  tooltip?: string;
}

/** Regenerate action for the workshop document toolbar (same chrome as preview / print). */
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
