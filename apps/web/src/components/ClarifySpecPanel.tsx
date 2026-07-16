import type { ClarifyDocumentPanelProps } from "@/components/ClarifyDocumentPanel";
import { ClarifyDocumentPanel } from "@/components/ClarifyDocumentPanel";
import { useWorkshopStore } from "@/store/workshopStore";

type ClarifySpecPanelProps = Omit<
  ClarifyDocumentPanelProps,
  "field" | "documentLabel" | "onClarify" | "allowSyncMdd"
> & {
  onClarify?: ClarifyDocumentPanelProps["onClarify"];
};

/**
 * Pre-MDD clarify flow for Spec tab (`/speckit.clarify` equivalent).
 * @deprecated Prefer `DocumentClarificationSection` o `ClarifyDocumentPanel` con `field="specContent"`.
 */
export function ClarifySpecPanel({
  onClarify: onClarifyProp,
  ...rest
}: ClarifySpecPanelProps) {
  const clarifyDocument = useWorkshopStore((s) => s.clarifyDocument);
  const onClarify =
    onClarifyProp ??
    (async (projectId, opts) => {
      const res = await clarifyDocument(projectId, opts);
      if (!res) return null;
      return {
        clarifiedContent: res.clarifiedContent,
        clarificationMarkerCount: res.clarificationMarkerCount,
        mddSyncQueued: res.mddSyncQueued,
      };
    });

  return (
    <ClarifyDocumentPanel
      field="specContent"
      documentLabel="Spec"
      onClarify={onClarify}
      allowSyncMdd
      {...rest}
    />
  );
}
