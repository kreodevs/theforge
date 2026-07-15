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
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { stripMermaidFenceWrappers } from "@theforge/shared-types/mermaid";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { isExcalidrawSupported, type MermaidDiagramType } from "./mermaid-diagram-type.util";

import "@excalidraw/excalidraw/index.css";

type ExcalidrawModule = typeof import("@excalidraw/excalidraw");
type ExcalidrawComponent = ExcalidrawModule["Excalidraw"];
type OrderedExcalidrawElement = ReturnType<ExcalidrawModule["convertToExcalidrawElements"]>[number];

// Lazy-loaded Excalidraw (no SSR, ~45MB JS)
const LazyExcalidraw = lazy<ExcalidrawComponent>(() =>
  import("@excalidraw/excalidraw").then((mod) => ({ default: mod.Excalidraw })),
);

type ConvertedScene = {
  elements: OrderedExcalidrawElement[];
  files: BinaryFiles | null;
};

async function convertMermaidToExcalidraw(content: string): Promise<ConvertedScene> {
  const prepared = stripMermaidFenceWrappers(content).trim();
  const [mermaidMod, excalidrawMod] = await Promise.all([
    import("@excalidraw/mermaid-to-excalidraw"),
    import("@excalidraw/excalidraw"),
  ]);
  // ER / sequence / class arrive as image skeletons — `files` holds the dataURLs.
  const { elements: skeletons, files } = await mermaidMod.parseMermaidToExcalidraw(prepared);
  const elements = excalidrawMod.convertToExcalidrawElements(skeletons, {
    regenerateIds: false,
  });
  return { elements, files: files ?? null };
}

async function exportToPng(scene: ConvertedScene) {
  const mod: ExcalidrawModule = await import("@excalidraw/excalidraw");
  return mod.exportToBlob({
    elements: scene.elements,
    files: scene.files,
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
  | { status: "ok"; scene: ConvertedScene }
  | { status: "fallback" }
  | { status: "error"; message: string };

export function ExcalidrawDiagramBlock({
  mermaidContent,
  diagramType,
  rebuildKey,
  onFallbackToSvg,
  className,
}: ExcalidrawDiagramBlockProps) {
  const [scene, setScene] = useState<ConvertedScene | null>(null);
  /** Remount Excalidraw when scene changes — `initialData` is mount-only. */
  const [sceneRev, setSceneRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const cancelledRef = useRef(false);
  const onFallbackRef = useRef(onFallbackToSvg);
  onFallbackRef.current = onFallbackToSvg;

  const excalidrawSupported = isExcalidrawSupported(diagramType);

  const applyScene = useCallback((next: ConvertedScene) => {
    setScene(next);
    setSceneRev((n) => n + 1);
    setLoading(false);
    setError(null);
  }, []);

  const failToSvg = useCallback((message?: string) => {
    setLoading(false);
    if (message) setError(message);
    onFallbackRef.current?.();
  }, []);

  // Convert Mermaid → Excalidraw elements (+ files for image fallbacks)
  useEffect(() => {
    if (!excalidrawSupported) {
      failToSvg();
      return;
    }

    cancelledRef.current = false;
    let active = true;

    async function convert(): Promise<ConversionResult> {
      try {
        const converted = await convertMermaidToExcalidraw(mermaidContent);
        if (cancelledRef.current) return { status: "fallback" };
        if (Array.isArray(converted.elements) && converted.elements.length > 0) {
          return { status: "ok", scene: converted };
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
        applyScene(result.scene);
      } else if (result.status === "fallback") {
        failToSvg();
      } else {
        failToSvg(result.message);
      }
    });

    return () => {
      active = false;
      cancelledRef.current = true;
    };
  }, [mermaidContent, rebuildKey, excalidrawSupported, applyScene, failToSvg]);

  // Manual rebuild
  const handleRebuild = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const converted = await convertMermaidToExcalidraw(mermaidContent);
      if (Array.isArray(converted.elements) && converted.elements.length > 0) {
        applyScene(converted);
      } else {
        failToSvg();
      }
    } catch (err) {
      failToSvg(err instanceof Error ? err.message : "Rebuild failed");
    }
  }, [mermaidContent, applyScene, failToSvg]);

  // Export PNG
  const handleExport = useCallback(async () => {
    if (!scene) return;
    try {
      const blob = await exportToPng(scene);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [scene]);

  // Loading state (only when no scene yet)
  if (loading && !scene) {
    return (
      <div className="flex min-h-[180px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        <span className="ml-2 text-sm text-[var(--muted-foreground)]">
          Convirtiendo a Excalidraw…
        </span>
      </div>
    );
  }

  // Error or no scene — caller falls back to SVG
  if (error || !scene) return null;

  const bg = isEditing ? "bg-[var(--background)]" : "bg-transparent";

  return (
    <div
      className={cn(
        // Excalidraw uses height:100% — parent must have non-zero explicit height
        "relative h-[min(420px,55vh)] w-full min-h-[220px]",
        bg,
        className,
      )}
    >
      {/* Toolbar */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)]/95 p-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={loading}
          onClick={() => void handleRebuild()}
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
          onClick={() => void handleExport()}
          title="Exportar PNG"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Excalidraw canvas — fill container */}
      <div className="absolute inset-0 overflow-hidden rounded-md [&_.excalidraw]:h-full [&_.excalidraw]:w-full">
        <Suspense
          fallback={
            <div className="flex h-full min-h-[180px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
            </div>
          }
        >
          <LazyExcalidraw
            key={sceneRev}
            initialData={{
              elements: scene.elements,
              files: scene.files ?? undefined,
              scrollToContent: true,
            }}
            theme="dark"
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
    </div>
  );
}
