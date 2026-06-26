import { Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { WorkshopHeaderIconButton } from "@/components/WorkshopButtons";

interface DownloadZipButtonProps {
  onClick: () => void;
  /** Si hay gobernanza generada, el ZIP incluye spec-kit + docs/agent-governance + docs/sdd. */
  hasAgentGovernance?: boolean;
}

/** Download project ZIP from the workshop header toolbar. */
export function WorkshopDownloadZipButton({
  onClick,
  hasAgentGovernance = false,
}: DownloadZipButtonProps) {
  const tooltip = hasAgentGovernance
    ? "Descargar ZIP handoff (spec-kit, gobernanza y docs/sdd)"
    : "Descargar ZIP con los documentos del proyecto";
  const ariaLabel = hasAgentGovernance
    ? "Descargar ZIP handoff del proyecto"
    : "Descargar documentos del proyecto en ZIP";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <WorkshopHeaderIconButton onClick={onClick} aria-label={ariaLabel}>
          <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        </WorkshopHeaderIconButton>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
