import type { ResolveClarificationsPanelProps } from "@/components/ResolveClarificationsPanel";
import { ResolveClarificationsPanel } from "@/components/ResolveClarificationsPanel";

type ClarifySpecPanelProps = Omit<
  ResolveClarificationsPanelProps,
  "field" | "documentLabel"
>;

/**
 * Wrapper de `ResolveClarificationsPanel` para Spec (compat toolbar).
 * @deprecated Prefer `DocumentClarificationSection` con `field="specContent"`.
 */
export function ClarifySpecPanel(props: ClarifySpecPanelProps) {
  return (
    <ResolveClarificationsPanel
      field="specContent"
      documentLabel="Spec"
      {...props}
    />
  );
}
