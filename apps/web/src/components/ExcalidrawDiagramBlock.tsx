/**
 * Renders Mermaid diagrams as Excalidraw canvas with lazy loading.
 * Supports conversion of flowcharts, ER, sequence, and class diagrams.
 * Falls back to SVG view for unsupported types or conversion failures.
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Download, Edit3, Eye, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { isExcalidrawSupported, type MermaidDiagramType } from "./mermaid-diagram-type.util";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");
type ExcalidrawComponent = ExcalidrawModule["Excalidraw"];
type OrderedExcalidrawElement = ReturnType<ExcalidrawModule["convertToExcalidrawElements"]>[number];

// Lazy-loaded Excalidraw (no SSR, ~45MB)
const LazyExcalidraw = lazy<ExcalidrawComponent>(() =>
  import("@excalidraw/excalidraw").then((mod) => ({ default: mod.Excalidraw })),
);

async function convertMermaidToExcalidraw(content: string): Promise<OrderedExcalidrawElement[]> {
  const [mermaidMod, excalidrawMod] = await Promise.all([
    import("@excalidraw/mermaid-to-excalidraw"),
    import("@excalidraw/excalidraw"),
  ]);
  const result = await mermaidMod.parseMermaidToExcalidraw(content);
  return excalidrawMod.convertToExcalidrawElements(result.elements, { regenerateIds: false });
}

async function exportToPng(elements: readonly OrderedExcalidrawElement[]) {
  const mod: ExcalidrawModule = await import("@excalidraw/excalidraw");
  return mod.exportToBlob({
    elements,
    files: null,
    mimeType: "image/png",
  });
}

type ExcalidrawDiagramBlockProps = {
  mermaidContent: string;
  diagramType: MermaidDiagramType;
  /** Key that changes when source content is edited — triggers rebuild. */
  rebuildKey?: string;
  /** Called when conversion fails; consumer should fall back to SVG. */
  onFallbackToSvg?: () => void;
  /** Additional CSS classes for the outer container (e.g. h-full for fullscreen). */
  className?: string;
};

type ConversionResult =
  | { status: "ok"; elements: OrderedExcalidrawElement[] }
  | { status: "fallback" }
  | { status: "error"; message: string };

export function ExcalidrawDiagramBlock({
  mermaidContent,
  diagramType,
  rebuildKey,
  onFallbackToSvg,
  className,
}: ExcalidrawDiagramBlockProps) {
  const [elements, setElements] = useState<OrderedExcalidrawElement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const cancelledRef = useRef(false);

  const excalidrawSupported = isExcalidrawSupported(diagramType);

  // Convert Mermaid → Excalidraw elements
  useEffect(() => {
    cancelledRef.current = false;
    let active = true;

    async function convert(): Promise<ConversionResult> {
      try {
        const convertedElements = await convertMermaidToExcalidraw(mermaidContent);
        if (cancelledRef.current) return { status: "fallback" };
        if (Array.isArray(convertedElements) && convertedElements.length > 0) {
          return { status: "ok", elements: convertedElements };
        }
        return { status: "fallback" };
      } catch (err) {
        if (cancelledRef.current) return { status: "fallback" };
        return {
          status: "error",
          message: err instanceof Error ? err.message : "Conversion failed",
        };
      }
    }

    setLoading(true);
    setError(null);

    convert().then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setElements(result.elements);
        setLoading(false);
      } else if (result.status === "fallback") {
        onFallbackToSvg?.();
      } else {
        setError(result.message);
        onFallbackToSvg?.();
      }
    });

    return () => {
      active = false;
      cancelledRef.current = true;
    };
  }, [mermaidContent, rebuildKey, excalidrawSupported, onFallbackToSvg]);

  // Manual rebuild
  const handleRebuild = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const convertedElements = await convertMermaidToExcalidraw(mermaidContent);
      if (Array.isArray(convertedElements) && convertedElements.length > 0) {
        setElements(convertedElements);
      } else {
        onFallbackToSvg?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rebuild failed");
      onFallbackToSvg?.();
    } finally {
      setLoading(false);
    }
  }, [mermaidContent, onFallbackToSvg]);

  // Export PNG
  const handleExport = useCallback(async () => {
    if (!elements) return;
    try {
      const blob = await exportToPng(elements);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [elements]);

  // Loading state (only when no elements yet)
  if (loading && !elements) {
    return (
      <div className="flex min-h-[180px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        <span className="ml-2 text-sm text-[var(--muted-foreground)]">
          Convirtiendo a Excalidraw…
        </span>
      </div>
    );
  }

  // Error or no elements — caller falls back to SVG
  if (error || !elements) return null;

  const bg = isEditing ? "bg-[var(--background)]" : "bg-transparent";

  return (
    <div className={cn("relative min-h-[180px]", bg, className)}>
      {/* Toolbar */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)]/95 p-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={loading}
          onClick={handleRebuild}
          title="Reconstruir desde Mermaid"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsEditing((e) => !e)}
          title={isEditing ? "Modo vista" : "Modo edición"}
        >
          {isEditing ? <Eye className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleExport}
          title="Exportar PNG"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Excalidraw canvas */}
      <Suspense
        fallback={
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
          </div>
        }
      >
        <LazyExcalidraw
          initialData={{ elements, scrollToContent: true }}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              saveAsImage: false,
            },
            tools: {
              image: false,
            },
          }}
          viewModeEnabled={!isEditing}
        />
      </Suspense>
    </div>
  );
}
