import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UxUiGuidePanel } from "@/components/UxUiGuidePanel";
import { replaceYamlFrontMatter } from "@/components/DesignMdPreview";
import type { WorkshopUxGuidePanelProps } from "./workshopUxGuidePanel.types";

export function WorkshopUxGuidePanel({
  projectName,
  uxUiGuideContent,
  uxUiGuideDirty,
  uxUiGuideViewMode,
  effectiveMddTrimmed,
  blueprintContent,
  loading,
  uxGenerating,
  uxGuideDesignRef,
  docTs,
  onUxUiGuideContentChange,
  onPersistUxUiGuideContent,
  onGenerateUxGuide,
  onDesignRefChange,
  onUxUiGuideBlur,
}: WorkshopUxGuidePanelProps) {
  return (
    <ErrorBoundary>
      <UxUiGuidePanel
        key={uxUiGuideContent ? "populated" : "empty"}
        content={uxUiGuideContent}
        onContentChange={onUxUiGuideContentChange}
        onSave={() => {
          const content = replaceYamlFrontMatter(uxUiGuideContent ?? "", projectName);
          if (content !== (uxUiGuideContent ?? "")) onUxUiGuideContentChange(content);
          void onPersistUxUiGuideContent(content);
        }}
        isDirty={uxUiGuideDirty}
        viewMode={uxUiGuideViewMode}
        onGenerate={onGenerateUxGuide}
        canGenerate={!!(effectiveMddTrimmed && blueprintContent?.trim())}
        isLoading={loading}
        isGenerating={uxGenerating}
        designRef={uxGuideDesignRef}
        onDesignRefChange={(ref) => {
          void onDesignRefChange(ref);
        }}
        onDesignRefAutoMatch={() => {
          void onDesignRefChange("auto");
        }}
        placeholder="# Design System\n\nConversa con la IA sobre marca, estilos, prioridades y componentes; el contenido se irá generando aquí."
        onBlur={onUxUiGuideBlur}
        documentTimestamps={docTs("uxUiGuideContent")}
      />
    </ErrorBoundary>
  );
}
