import { Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DocEmptyState } from "@/components/DocEmptyState";
import { DesignMdPreview } from "@/components/DesignMdPreview";
import { DesignRefSelector } from "@/components/DesignRefSelector";
import MddViewer from "@/components/MddViewer";
import { AiDocumentBuildingPlaceholder } from "@/components/AiGenerationLoader";
import { WorkshopDocSourceSaveBar, WORKSHOP_DOC_EMPTY_PRIMARY_BTN } from "@/components/WorkshopDocSourceSaveBar";
import { WorkshopDocTextarea } from "@/components/WorkshopDocTextarea";
import { WorkshopDocumentStampBar } from "@/components/WorkshopDocumentStampBar";
import type { WorkshopDocumentTimestamps } from "@/utils/workshop-document-content.util";

interface UxUiGuidePanelProps {
  content: string | null;
  onContentChange: (value: string | null) => void;
  onSave: () => void;
  isDirty: boolean;
  viewMode: "preview" | "source" | "design";
  onGenerate: () => void;
  canGenerate: boolean;
  isLoading: boolean;
  isGenerating: boolean;
  designRef?: string | null;
  onDesignRefChange: (ref: string | null) => void;
  onDesignRefAutoMatch?: () => void;
  placeholder?: string;
  onBlur?: () => void;
  documentTimestamps?: WorkshopDocumentTimestamps | null;
}

/**
 * Panel Design System — 3 modos: preview (MddViewer), design (DesignMdPreview + UI Kit), source (textarea + YAML repair).
 */
export function UxUiGuidePanel({
  content,
  onContentChange,
  onSave,
  isDirty,
  viewMode,
  onGenerate,
  canGenerate,
  isLoading,
  isGenerating,
  designRef,
  onDesignRefChange,
  onDesignRefAutoMatch,
  placeholder,
  onBlur,
  documentTimestamps,
}: UxUiGuidePanelProps) {
  const isEmpty = !content?.trim();

  const designRefBar = (
    <div className="mb-3 shrink-0 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-3 py-2.5">
      <DesignRefSelector
        currentRef={designRef}
        onChange={onDesignRefChange}
        onAutoMatch={onDesignRefAutoMatch}
      />
    </div>
  );

  if (isEmpty && (viewMode === "preview" || viewMode === "design")) {
    return (
      <>
        {designRefBar}
        <DocEmptyState
        icon={Palette}
        title="Design System"
        description="Tokens de diseño (colores, tipografía, espaciado) y un UI Kit de ejemplo con hasta 10 componentes. Se genera desde el MDD y el Blueprint."
        onGenerate={onGenerate}
        loading={isGenerating || isLoading}
        hasMdd={canGenerate}
      />
      </>
    );
  }

  return (
    <>
      {designRefBar}
      {viewMode === "design" ? (
        <div key="design-view" className="flex min-h-0 flex-1 flex-col overflow-auto">
          <WorkshopDocumentStampBar timestamps={documentTimestamps} />
          <DesignMdPreview content={content ?? ""} />
        </div>
      ) : viewMode === "preview" ? (
        <div key="preview-view" className="min-h-0 flex-1">
          <MddViewer content={content ?? ""} documentTimestamps={documentTimestamps} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <WorkshopDocumentStampBar timestamps={documentTimestamps} />
          <WorkshopDocSourceSaveBar onSave={onSave} disabled={!isDirty} />
          <WorkshopDocTextarea
            value={content ?? ""}
            onChange={(v) => onContentChange(v || null)}
            onBlur={onBlur}
            placeholder={
              placeholder ??
              "# Design System\n\nMarca, colores, tipografía, componentes y tokens para el producto..."
            }
            className="min-h-0 w-full flex-1 resize-none rounded-lg border border-[var(--border)] bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] p-4 font-mono text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--primary)]"
            spellCheck={false}
          />
        </div>
      )}
      {isEmpty && viewMode === "source" && (
        <div className="mt-4 flex min-h-[200px] w-full shrink-0 justify-center sm:justify-end">
          {isGenerating || isLoading ? (
            <AiDocumentBuildingPlaceholder documentTitle="Design System" />
          ) : (
            <Button
              type="button"
              variant="default"
              size="default"
              className={cn("w-full max-w-md sm:w-auto sm:min-w-[280px]", WORKSHOP_DOC_EMPTY_PRIMARY_BTN)}
              onClick={onGenerate}
              disabled={isGenerating || isLoading || !canGenerate}
            >
              <Sparkles className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
              Generar Design System desde MDD
            </Button>
          )}
        </div>
      )}
    </>
  );
}
