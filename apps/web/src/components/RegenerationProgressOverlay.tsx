import { RegenerationProgressBanner } from "@/components/RegenerationProgressBanner";
import type { ComponentSourceRegenerationStep } from "@/types/component-source-profiles";

interface RegenerationProgressOverlayProps {
  title?: string;
  progress: ComponentSourceRegenerationStep | null;
  stepsHistory: ComponentSourceRegenerationStep[];
  error?: string | null;
}

/**
 * Full-screen overlay for MCP profile regeneration (Workshop + Settings).
 * Matches WireframesPanel centered stepper when wireframes are empty.
 */
export function RegenerationProgressOverlay({
  title = "Regeneración por cambio de MCP",
  progress,
  stepsHistory,
  error,
}: RegenerationProgressOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_oklch,var(--background)_72%,transparent)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-regeneration-overlay-title"
    >
      <div className="w-full max-w-lg">
        <RegenerationProgressBanner
          title={title}
          progress={progress}
          stepsHistory={stepsHistory}
          error={error}
        />
      </div>
    </div>
  );
}
