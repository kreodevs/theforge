/**
 * Phase0PastePanel — Pegar DBGA manualmente como Paso 0.
 */

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { useWorkshopStore } from "../store/workshopStore";
import { formatUserFacingThrownError } from "../utils/httpError";
import { WorkshopPanelActionRegion, WorkshopPanelButton, WorkshopButtonIcon } from "./WorkshopButtons";
import { WorkshopDocTextarea } from "./WorkshopDocTextarea";

interface Props {
  projectId: string;
  onComplete: () => void | Promise<void>;
}

export function Phase0PastePanel({ onComplete }: Props) {
  const persistDbgaContent = useWorkshopStore((s) => s.persistDbgaContent);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await persistDbgaContent(trimmed);
      await onComplete();
    } catch (e) {
      setError(formatUserFacingThrownError(e, "No se pudo guardar el Paso 0"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <WorkshopPanelActionRegion
        role="region"
        aria-label="Pegar Paso 0"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <p className="shrink-0 text-sm leading-relaxed text-[var(--foreground-subtle)]">
            Pega aquí tu DBGA (Domain Benchmark & Gap Analysis) ya redactado para usarlo como Paso 0.
          </p>
          <WorkshopDocTextarea
            value={content}
            onChange={setContent}
            placeholder="# Domain Benchmark & Gap Analysis..."
            className="flex-1 min-h-[200px] w-full bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] border border-[var(--border)] rounded-lg p-4 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent outline-none resize-none"
            spellCheck={false}
          />
          {error ? (
            <p
              className="text-sm text-[color-mix(in_oklch,var(--destructive)_88%,var(--foreground))]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="flex shrink-0 gap-2">
            <WorkshopPanelButton
              tone="primary"
              onClick={() => void handleSave()}
              disabled={!content.trim() || saving}
              loading={saving}
            >
              <WorkshopButtonIcon icon={ClipboardPaste} tone="primary" />
              Guardar Paso 0
            </WorkshopPanelButton>
          </div>
        </div>
      </WorkshopPanelActionRegion>
    </div>
  );
}
