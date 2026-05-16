import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import MddViewer from "@/components/MddViewer";
import { DocEmptyState } from "@/components/DocEmptyState";
import { AiDocumentBuildingPlaceholder } from "@/components/AiGenerationLoader";
import { WorkshopDocSourceSaveBar } from "@/components/WorkshopDocSourceSaveBar";

export interface StandardDocPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  content: string | null;
  onContentChange: (value: string | null) => void;
  onSave: () => void;
  isDirty: boolean;
  viewMode: "preview" | "source";
  onGenerate: () => void;
  canGenerate: boolean;
  isLoading: boolean;
  generateLabel?: string;
  placeholder?: string;
  onBlur?: () => void;
  /** Legacy generate (desde codebase, para spec/blueprint). */
  legacyGenerateLabel?: string;
  onLegacyGenerate?: () => void;
  legacyGenerateLoading?: boolean;
  /** Bloqueo específico (ej. Blueprint §3). */
  generateBlocked?: boolean;
  generateBlockedReason?: string;
}

/**
 * Panel de documento estándar — 3 estados:
 * 1. Preview vacío → DocEmptyState (icono + descripción + botón Generar)
 * 2. Preview con contenido → MddViewer
 * 3. Source mode → textarea + savebar + botón "Generar" si está vacío
 */
export function StandardDocPanel({
  icon,
  title,
  description,
  content,
  onContentChange,
  onSave,
  isDirty,
  viewMode,
  onGenerate,
  canGenerate,
  isLoading,
  generateLabel,
  placeholder,
  onBlur,
  legacyGenerateLabel,
  onLegacyGenerate,
  legacyGenerateLoading,
  generateBlocked,
  generateBlockedReason,
}: StandardDocPanelProps) {
  // Estado 1: preview vacío → DocEmptyState
  if (viewMode === "preview" && !content?.trim()) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DocEmptyState
          icon={icon}
          title={title}
          description={description}
          onGenerate={onGenerate}
          loading={isLoading}
          hasMdd={canGenerate}
          generateBlocked={generateBlocked}
          generateBlockedReason={generateBlockedReason}
          legacyGenerateLabel={legacyGenerateLabel}
          onLegacyGenerate={onLegacyGenerate}
          legacyGenerateLoading={legacyGenerateLoading}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {viewMode === "preview" ? (
        /* Estado 2: preview con contenido */
        <MddViewer content={content || ""} />
      ) : (
        /* Estado 3: source mode */
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <WorkshopDocSourceSaveBar onSave={onSave} disabled={!isDirty} />
            <textarea
              value={content ?? ""}
              onChange={(e) => onContentChange(e.target.value || null)}
              onBlur={onBlur}
              placeholder={placeholder ?? `# ${title}\n\nEl contenido se genera aquí o puedes escribirlo manualmente...`}
              className="min-h-0 w-full flex-1 bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] border border-[var(--border)] rounded-lg p-4 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none resize-none"
              spellCheck={false}
            />
          </div>
          {!content?.trim() && (
            <div className="shrink-0 mt-4 flex min-h-[200px] w-full justify-center sm:justify-end">
              {isLoading ? (
                <AiDocumentBuildingPlaceholder documentTitle={title} />
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  className={cn("w-full max-w-md sm:w-auto sm:min-w-[280px]", "h-12 gap-2 rounded-xl text-base font-semibold shadow-md shadow-[color-mix(in_oklch,var(--primary)_42%,transparent)] hover:shadow-lg hover:shadow-[color-mix(in_oklch,var(--primary)_48%,transparent)]")}
                  onClick={onGenerate}
                  disabled={!canGenerate}
                >
                  <Sparkles className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                  {generateLabel ?? `Generar ${title} desde MDD`}
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
